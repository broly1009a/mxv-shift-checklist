import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { CleanAccountRecord, CleanAccountRecordDocument } from '../../../schemas/clean-account-record.schema';
import { TkgdConfigService } from './tkgd-config.service';
import {
  reconcileAndExportToExcel,
  ReconcileSummary,
  getTkgdOutputDirectory,
  getTkgdAttachmentDirectory,
  resolveTkgdOutputDir,
} from '../../bot-engine/helpers/tkgd-reconcile-exporter.helper';
import {
  isIgnoredEmailAttachment,
  isNamedCccdFront,
  isNamedCccdBack,
  probeImageDimensions,
} from '../../bot-engine/helpers/tkgd-mail-parser.helper';

@Injectable()
export class TkgdExcelExportService {
  private readonly logger = new Logger(TkgdExcelExportService.name);

  constructor(
    @InjectModel(CleanAccountRecord.name) private cleanRecordModel: Model<CleanAccountRecordDocument>,
    private readonly configService: TkgdConfigService,
  ) {}

  /**
   * Lấy đường dẫn file Excel xuất mới nhất
   */
  async getLatestExcelFilePath(userEmail: string): Promise<string | null> {
    const config = await this.configService.getUserConfig(userEmail);
    const primaryDir = resolveTkgdOutputDir(config?.storage?.windowsPath);

    const candidateDirs = [
      primaryDir,
      getTkgdOutputDirectory(),
      '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD',
      path.resolve(process.cwd(), '../POC/TKGD-Automation/output'),
      process.cwd(),
    ].filter((d) => d && fs.existsSync(d));

    const foundFiles: { name: string; fullPath: string; mtime: number }[] = [];
    const seen = new Set<string>();

    for (const d of candidateDirs) {
      try {
        const list = fs.readdirSync(d);
        for (const f of list) {
          if (f.startsWith('Auto_Data_mail_') && (f.endsWith('.xlsx') || f.endsWith('.xlsm'))) {
            const fullPath = path.join(d, f);
            if (!seen.has(fullPath)) {
              seen.add(fullPath);
              foundFiles.push({
                name: f,
                fullPath,
                mtime: fs.statSync(fullPath).mtimeMs,
              });
            }
          }
        }
      } catch {}
    }

    foundFiles.sort((a, b) => b.mtime - a.mtime);
    return foundFiles.length > 0 ? foundFiles[0].fullPath : null;
  }

  /**
   * Quét và phân loại toàn bộ tệp hồ sơ đính kèm (Mail & M-System) phục vụ giao diện đối soát trực quan
   */
  async getAccountFilesManifest(
    userEmail: string,
    accountCode: string,
    batchDate?: string,
  ) {
    const code = (accountCode || '').trim();
    if (!code) {
      return { success: false, message: 'Thiếu mã tài khoản' };
    }

    const config = await this.configService.getUserConfig(userEmail);

    const queryFilter: any = {
      $or: [
        { maTKGDBase: code },
        { maTKGD: code },
        { 'noiDungMail.maTKGD_Futures': code },
      ],
    };
    if (batchDate && batchDate.trim()) {
      queryFilter.batchDate = batchDate.trim();
    }

    const record = await this.cleanRecordModel
      .findOne(queryFilter)
      .sort({ batchDate: -1, createdAt: -1 })
      .lean();

    const effectiveBatchDate =
      batchDate?.trim() || record?.batchDate || new Date().toISOString().slice(0, 10);

    // Xác định các thư mục tiềm năng chứa hồ sơ tài khoản này
    const candidateDirs: string[] = [];

    // 1. Thư mục chuẩn theo config hoặc mặc định
    const standardDir = getTkgdAttachmentDirectory(
      config?.documentProcessing?.attachmentSavePath || config?.storage?.windowsPath,
      effectiveBatchDate,
      code,
    );
    candidateDirs.push(standardDir);

    // 2. Thử các đường dẫn mạng cố định trên Linux & Windows
    const netBases = [
      '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD',
      path.resolve(process.cwd(), '../POC/TKGD-Automation/output'),
      path.join(process.cwd(), 'data', 'temp_tkgd_attachments'),
    ];

    for (const b of netBases) {
      if (b && fs.existsSync(b)) {
        candidateDirs.push(getTkgdAttachmentDirectory(b, effectiveBatchDate, code));
      }
    }

    let foundDir: string | null = null;
    let filesInDir: string[] = [];

    for (const dir of candidateDirs) {
      if (dir && fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir);
          if (files.length > 0) {
            foundDir = dir;
            filesInDir = files;
            break;
          }
        } catch {}
      }
    }

    let mailCccdFront: any = null;
    let mailCccdBack: any = null;
    let mailContractPdf: any = null;
    let mailPl01Pdf: any = null;

    let msCccdFront: any = null;
    let msCccdBack: any = null;
    let msSignature: any = null;

    const otherFiles: any[] = [];

    const buildFileObj = (fName: string, subType: string) => {
      let fileSize = 0;
      if (foundDir) {
        try {
          fileSize = fs.statSync(path.join(foundDir, fName)).size;
        } catch {}
      }
      return {
        fileName: fName,
        size: fileSize,
        subType,
        url: `/api/v1/tkgd/files/stream?accountCode=${encodeURIComponent(code)}&batchDate=${encodeURIComponent(effectiveBatchDate)}&fileName=${encodeURIComponent(fName)}`,
      };
    };

    for (const f of filesInDir) {
      let fileSize: number | undefined = undefined;
      if (foundDir) {
        try {
          fileSize = fs.statSync(path.join(foundDir, f)).size;
        } catch {}
      }
      if (isIgnoredEmailAttachment(f, fileSize)) continue;
      const lower = f.toLowerCase();
      const isMS = lower.includes('_ms_') || lower.startsWith(`${code.toLowerCase()}_ms`);

      if (lower.endsWith('.pdf')) {
        if (lower.includes('pl01') || lower.includes('phuluc') || lower.includes('-pl')) {
          if (!mailPl01Pdf) mailPl01Pdf = buildFileObj(f, 'MAIL_PL01');
          else otherFiles.push(buildFileObj(f, 'PDF'));
        } else if (lower.includes('mxv') || lower.includes('hopdong') || lower.includes('hd')) {
          if (!mailContractPdf) mailContractPdf = buildFileObj(f, 'MAIL_CONTRACT');
          else otherFiles.push(buildFileObj(f, 'PDF'));
        } else {
          if (!mailContractPdf) mailContractPdf = buildFileObj(f, 'MAIL_CONTRACT');
          else otherFiles.push(buildFileObj(f, 'PDF'));
        }
      } else if (['.jpg', '.jpeg', '.png', '.webp'].some((ext) => lower.endsWith(ext))) {
        if (isMS) {
          if (lower.includes('truoc') || lower.includes('front') || lower.includes('mat1')) {
            msCccdFront = buildFileObj(f, 'MS_CCCD_FRONT');
          } else if (lower.includes('sau') || lower.includes('back') || lower.includes('mat2')) {
            msCccdBack = buildFileObj(f, 'MS_CCCD_BACK');
          } else if (lower.includes('chuky') || lower.includes('ky') || lower.includes('signature')) {
            msSignature = buildFileObj(f, 'MS_SIGNATURE');
          } else {
            otherFiles.push(buildFileObj(f, 'IMAGE'));
          }
        } else {
          const fullPath = foundDir ? path.join(foundDir, f) : '';
          const dims = fullPath && fs.existsSync(fullPath) ? probeImageDimensions(fullPath) : null;
          if (isIgnoredEmailAttachment(f, fileSize, dims)) {
            otherFiles.push(buildFileObj(f, 'IMAGE'));
          } else if (isNamedCccdFront(lower)) {
            mailCccdFront = buildFileObj(f, 'MAIL_CCCD_FRONT');
          } else if (isNamedCccdBack(lower)) {
            mailCccdBack = buildFileObj(f, 'MAIL_CCCD_BACK');
          } else if (lower.includes('chuky') || lower.includes('signature')) {
            otherFiles.push(buildFileObj(f, 'IMAGE'));
          } else if (!mailCccdFront && !/^image\d*\./i.test(lower)) {
            mailCccdFront = buildFileObj(f, 'MAIL_CCCD_FRONT');
          } else if (!mailCccdBack && !/^image\d*\./i.test(lower)) {
            mailCccdBack = buildFileObj(f, 'MAIL_CCCD_BACK');
          } else {
            otherFiles.push(buildFileObj(f, 'IMAGE'));
          }
        }
      } else {
        otherFiles.push(buildFileObj(f, 'OTHER'));
      }
    }

    // Fallback: nếu MS chưa có trong folder nhưng có path trong DB record
    if (!msCccdFront && record?.ms?.cccdMatTruocLocalPath && fs.existsSync(record.ms.cccdMatTruocLocalPath)) {
      msCccdFront = {
        fileName: path.basename(record.ms.cccdMatTruocLocalPath),
        size: fs.statSync(record.ms.cccdMatTruocLocalPath).size,
        subType: 'MS_CCCD_FRONT',
        url: `/api/v1/tkgd/files/stream?filePath=${encodeURIComponent(record.ms.cccdMatTruocLocalPath)}`,
      };
    }
    if (!msCccdBack && record?.ms?.cccdMatSauLocalPath && fs.existsSync(record.ms.cccdMatSauLocalPath)) {
      msCccdBack = {
        fileName: path.basename(record.ms.cccdMatSauLocalPath),
        size: fs.statSync(record.ms.cccdMatSauLocalPath).size,
        subType: 'MS_CCCD_BACK',
        url: `/api/v1/tkgd/files/stream?filePath=${encodeURIComponent(record.ms.cccdMatSauLocalPath)}`,
      };
    }
    if (!msSignature && record?.ms?.chuKyLocalPath && fs.existsSync(record.ms.chuKyLocalPath)) {
      msSignature = {
        fileName: path.basename(record.ms.chuKyLocalPath),
        size: fs.statSync(record.ms.chuKyLocalPath).size,
        subType: 'MS_SIGNATURE',
        url: `/api/v1/tkgd/files/stream?filePath=${encodeURIComponent(record.ms.chuKyLocalPath)}`,
      };
    }

    return {
      success: true,
      accountCode: code,
      batchDate: effectiveBatchDate,
      directory: foundDir || standardDir,
      totalFiles: filesInDir.length,
      files: {
        mailCccdFront,
        mailCccdBack,
        mailContractPdf,
        mailPl01Pdf,
        msCccdFront,
        msCccdBack,
        msSignature,
      },
      otherFiles,
      ocrSummary: {
        theGeneration: record?.canCuoc?.theGeneration || 'CAN_CUOC_CHIP',
        confidenceScore: record?.canCuoc?.confidenceScore || 0.95,
        canhBaoChatLuong: record?.canCuoc?.canhBaoChatLuong || [],
      },
    };
  }

  /**
   * Định vị tệp đính kèm an toàn để stream về client
   */
  async resolveAttachmentFilePath(
    userEmail: string,
    options: { accountCode?: string; batchDate?: string; fileName?: string; filePath?: string },
  ): Promise<string | null> {
    const { accountCode, batchDate, fileName, filePath } = options;

    if (filePath && fs.existsSync(filePath)) {
      return filePath;
    }

    if (!fileName) return null;

    const safeFileName = path.basename(fileName);
    const code = accountCode?.trim();
    const config = await this.configService.getUserConfig(userEmail);
    const effectiveBatchDate = batchDate?.trim() || new Date().toISOString().slice(0, 10);

    const candidateBases = [
      config?.documentProcessing?.attachmentSavePath,
      config?.storage?.windowsPath,
      '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD',
      path.resolve(process.cwd(), '../POC/TKGD-Automation/output'),
      path.join(process.cwd(), 'data', 'temp_tkgd_attachments'),
    ].filter(Boolean) as string[];

    for (const base of candidateBases) {
      if (code) {
        const full = path.join(
          getTkgdAttachmentDirectory(base, effectiveBatchDate, code),
          safeFileName,
        );
        if (fs.existsSync(full)) return full;

        // Thử tìm không cần batchDate
        const fallbackNoDate = path.join(base, 'HoSo_DinhKem', code, safeFileName);
        if (fs.existsSync(fallbackNoDate)) return fallbackNoDate;
      }
    }

    return null;
  }

  /**
   * Xuất file Excel từ danh sách records
   */
  async exportReconciliationExcel(records: any[], targetFile: string): Promise<ReconcileSummary> {
    return await reconcileAndExportToExcel(records, {
      outputPath: targetFile,
    });
  }
}
