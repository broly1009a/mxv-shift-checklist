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
} from '../../engine-helpers/tkgd-reconcile-exporter.helper';
import {
  isIgnoredEmailAttachment,
  isNamedCccdFront,
  isNamedCccdBack,
  isNamedCccdImage,
  isNamedContractImage,
  probeImageDimensions,
  isMSystemThumbnailFile,
} from '../../engine-helpers/tkgd-mail-parser.helper';
import { extractZipFiles } from '../../engine-helpers/tkgd-doc-extractor.helper';

@Injectable()
export class TkgdExcelExportService {
  private readonly logger = new Logger(TkgdExcelExportService.name);

  constructor(
    @InjectModel(CleanAccountRecord.name) private cleanRecordModel: Model<CleanAccountRecordDocument>,
    private readonly configService: TkgdConfigService,
  ) {}

  /**
   * Lấy đường dẫn file Excel xuất mới nhất (hỗ trợ lọc chính xác theo batchDate)
   */
  async getLatestExcelFilePath(userEmail: string, batchDate?: string): Promise<string | null> {
    const config = await this.configService.getUserConfig(userEmail);
    const primaryDir = resolveTkgdOutputDir(config?.storage?.windowsPath);

    const candidateDirs = [
      primaryDir,
      getTkgdOutputDirectory(),
      '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD',
      path.resolve(process.cwd(), '../POC/TKGD-Automation/output'),
      process.cwd(),
    ].filter((d) => d && fs.existsSync(d));

    const targetDateClean = batchDate ? batchDate.replace(/[-_ \/]/g, '') : null;

    const foundFiles: { name: string; fullPath: string; mtime: number; matchesDate: boolean }[] = [];
    const seen = new Set<string>();

    for (const d of candidateDirs) {
      try {
        const list = fs.readdirSync(d);
        for (const f of list) {
          if (f.startsWith('Auto_Data_mail_') && (f.endsWith('.xlsx') || f.endsWith('.xlsm'))) {
            const fullPath = path.join(d, f);
            if (!seen.has(fullPath)) {
              seen.add(fullPath);
              const matchesDate = targetDateClean ? f.includes(targetDateClean) : false;
              foundFiles.push({
                name: f,
                fullPath,
                mtime: fs.statSync(fullPath).mtimeMs,
                matchesDate,
              });
            }
          }
        }
      } catch {}
    }

    // Nếu người dùng yêu cầu ngày cụ thể (batchDate)
    if (targetDateClean) {
      const dateMatchedFiles = foundFiles.filter((f) => f.matchesDate);
      if (dateMatchedFiles.length > 0) {
        dateMatchedFiles.sort((a, b) => b.mtime - a.mtime);
        return dateMatchedFiles[0].fullPath;
      }
      // Không tìm thấy file đúng ngày yêu cầu:
      // Tuyệt đối không fallback sang file của ngày cũ khác để tránh tải nhầm dữ liệu sai!
      return null;
    }

    foundFiles.sort((a, b) => b.mtime - a.mtime);
    return foundFiles.length > 0 ? foundFiles[0].fullPath : null;
  }

  /**
   * Xuất file Excel đối soát động theo đúng bộ lọc (batchDate, khoảng ngày, hoặc toàn bộ DB)
   * Đảm bảo luôn lấy dữ liệu mới nhất từ CSDL, không phụ thuộc file cache tĩnh cũ.
   */
  async exportFilteredExcel(
    userEmail: string,
    options: {
      batchDate?: string;
      startDate?: string;
      endDate?: string;
      filter?: string;
      search?: string;
    } = {},
  ): Promise<{ filePath: string; totalRecords: number }> {
    const config = await this.configService.getUserConfig(userEmail);
    const outDir = resolveTkgdOutputDir(config?.storage?.windowsPath);
    if (!fs.existsSync(outDir)) {
      try {
        fs.mkdirSync(outDir, { recursive: true });
      } catch (err: any) {
        this.logger.warn(`[EXCEL] Không thể tạo thư mục outDir: ${err.message}`);
      }
    }

    const query: any = {};
    const { batchDate, startDate, endDate, search, filter } = options;

    if (startDate && endDate) {
      if (startDate === endDate) {
        query['batchDate'] = startDate;
      } else {
        query['batchDate'] = { $gte: startDate, $lte: endDate };
      }
    } else if (startDate) {
      query['batchDate'] = { $gte: startDate };
    } else if (endDate) {
      query['batchDate'] = { $lte: endDate };
    } else if (batchDate && batchDate.trim()) {
      query['batchDate'] = batchDate.trim();
    }
    // Nếu không có bất kỳ bộ lọc ngày nào, query = {} -> Lấy toàn bộ hơn 2.700 tài khoản trong DB

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { maTKGD: regex },
        { maTKGDBase: regex },
        { 'noiDungMail.tenTaiKhoan': regex },
        { 'noiDungMail.maTKGD_Futures': regex },
        { 'noiDungMail.maTKGD_ACM': regex },
        { 'ms.hoVaTen': regex },
        { 'ms.tenTKGD': regex },
        { 'ms.soCMND_HoChieu': regex },
      ];
    }

    this.logger.log(`[EXCEL] Đang truy vấn CSDL xuất Excel với query: ${JSON.stringify(query)}...`);
    let records = await this.cleanRecordModel
      .find(query)
      .sort({ createdAt: 1 })
      .lean();

    // Lọc theo trạng thái kết luận nếu có truyền filter cụ thể khác 'ALL'
    if (filter && filter.trim() && filter.toUpperCase() !== 'ALL') {
      const f = filter.trim().toUpperCase();
      records = records.filter((r) => {
        const status = r.manualReview?.isOverridden
          ? (r.manualReview.status || 'KHOP')
          : (r.ketLuan?.trangThai || (r as any).trangThaiDoiSoat);
        if (f === 'KHOP') return status === 'KHOP' || status === 'KHOP_TEXT';
        if (f === 'CAN_KIEM_TRA') return status === 'CAN_KIEM_TRA';
        if (f === 'LECH') {
          return status === 'LECH' || (status && status !== 'KHOP' && status !== 'KHOP_TEXT' && status !== 'CAN_KIEM_TRA' && status !== 'CHUA_XU_LY');
        }
        if (f === 'CHUA_XU_LY') return !status || status === 'CHUA_XU_LY';
        if (f === 'FUTURES') return r.accountType === 'FUTURES' || !r.maTKGD?.includes('-');
        if (f === 'ACM') return r.accountType === 'ACM' || r.maTKGD?.includes('-A');
        if (f === 'LME') return r.accountType === 'LME' || r.maTKGD?.includes('-L');
        if (f === 'SPREAD') return r.accountType === 'SPREAD' || r.maTKGD?.includes('-S');
        return true;
      });
    }

    this.logger.log(`[EXCEL] Tìm thấy ${records.length} tài khoản trong DB để xuất file.`);

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    let fileSuffix = `ALL_${dateStr}`;
    if (batchDate && batchDate.trim()) {
      fileSuffix = batchDate.trim().replace(/[-_ \/]/g, '');
    } else if (startDate && endDate) {
      fileSuffix = `${startDate.replace(/[-_ \/]/g, '')}_${endDate.replace(/[-_ \/]/g, '')}`;
    } else if (startDate) {
      fileSuffix = `Tu_${startDate.replace(/[-_ \/]/g, '')}`;
    }

    const targetFile = path.join(outDir, `Auto_Data_mail_${fileSuffix}.xlsx`);

    await reconcileAndExportToExcel(records, {
      outputPath: targetFile,
    });

    return {
      filePath: targetFile,
      totalRecords: records.length,
    };
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
        candidateDirs.push(path.join(b, code));
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
            // Tự động giải nén bất kỳ tệp .zip nào trong thư mục nếu chưa được bung
            if (filesInDir.some((f) => f.toLowerCase().endsWith('.zip'))) {
              for (const f of filesInDir) {
                if (f.toLowerCase().endsWith('.zip')) {
                  extractZipFiles(path.join(dir, f), dir);
                }
              }
              try {
                filesInDir = fs.readdirSync(dir);
              } catch {}
            }
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
      const isMS = isMSystemThumbnailFile(f, code);

      if (lower.endsWith('.pdf')) {
        if (lower.includes('pl01') || lower.includes('phuluc') || lower.includes('phụ lục') || lower.includes('-pl') || lower.includes('acm')) {
          if (!mailPl01Pdf) mailPl01Pdf = buildFileObj(f, 'MAIL_PL01');
          else otherFiles.push(buildFileObj(f, 'PDF'));
        } else if (isNamedCccdImage(lower) || lower.includes('cccd') || lower.includes('cmnd') || lower.includes('can cuoc') || lower.includes('cancuoc')) {
          otherFiles.push(buildFileObj(f, 'MAIL_CCCD_PDF'));
        } else if (isNamedContractImage(lower) || lower.includes('mxv') || lower.includes('hopdong') || lower.includes('hợp đồng') || lower.includes('hd') || lower.includes('all')) {
          if (!mailContractPdf) mailContractPdf = buildFileObj(f, 'MAIL_CONTRACT');
          else otherFiles.push(buildFileObj(f, 'PDF'));
        } else {
          otherFiles.push(buildFileObj(f, 'PDF'));
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
          } else if (isNamedContractImage(lower)) {
            if (!mailContractPdf) mailContractPdf = buildFileObj(f, 'MAIL_CONTRACT');
            else otherFiles.push(buildFileObj(f, 'IMAGE'));
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

    // NÂNG CẤP THÔNG MINH 1: Fallback từ đường dẫn DB record.hopDong / record.phuLuc
    if (!mailContractPdf && (record as any)?.hopDong?.localPath && fs.existsSync((record as any).hopDong.localPath)) {
      mailContractPdf = buildFileObj(path.basename((record as any).hopDong.localPath), 'MAIL_CONTRACT');
    }
    if (!mailPl01Pdf && (record as any)?.phuLuc?.localPath && fs.existsSync((record as any).phuLuc.localPath)) {
      mailPl01Pdf = buildFileObj(path.basename((record as any).phuLuc.localPath), 'MAIL_PL01');
    }

    // NÂNG CẤP THÔNG MINH 2: Nếu trong thư mục có file PDF chưa gán vào HĐ hay PL
    const unassignedPdfs = otherFiles.filter((o) => o.subType === 'PDF');
    if (!mailContractPdf && unassignedPdfs.length > 0) {
      // Ưu tiên file không có từ khóa Phụ lục
      const nonPlIndex = unassignedPdfs.findIndex(
        (p) => !/phu\s*luc|phuluc|pl01|acm/i.test(p.fileName)
      );
      const chosenIdx = nonPlIndex >= 0 ? nonPlIndex : 0;
      const targetPdf = unassignedPdfs[chosenIdx];
      mailContractPdf = {
        ...targetPdf,
        subType: 'MAIL_CONTRACT',
      };
      // Xóa khỏi otherFiles để không trùng
      const ofIdx = otherFiles.findIndex((o) => o.fileName === targetPdf.fileName);
      if (ofIdx >= 0) otherFiles.splice(ofIdx, 1);
    }

    if (!mailPl01Pdf && unassignedPdfs.length > 0) {
      const plIdx = otherFiles.findIndex(
        (o) => o.subType === 'PDF' && /phu\s*luc|phuluc|pl01|acm|tieu\s*khoan/i.test(o.fileName)
      );
      if (plIdx >= 0) {
        mailPl01Pdf = {
          ...otherFiles[plIdx],
          subType: 'MAIL_PL01',
        };
        otherFiles.splice(plIdx, 1);
      }
    }

    // NÂNG CẤP THÔNG MINH 3: Đổi tên file vật lý trên đĩa theo chuẩn để hiển thị & tải xuống chuẩn mực
    if (foundDir && mailContractPdf && mailContractPdf.fileName) {
      const oldName = mailContractPdf.fileName;
      const oldFull = path.join(foundDir, oldName);
      const isAlreadyStandard = oldName.startsWith(`${code} - Hợp đồng`) || oldName.startsWith(`${code}_HopDong`);
      if (!isAlreadyStandard && fs.existsSync(oldFull)) {
        const standardContractName = `${code} - Hợp đồng.pdf`;
        const newFull = path.join(foundDir, standardContractName);
        try {
          fs.renameSync(oldFull, newFull);
          mailContractPdf = buildFileObj(standardContractName, 'MAIL_CONTRACT');
          if (record?._id) {
            this.cleanRecordModel.updateOne(
              { _id: record._id },
              { $set: { 'hopDong.localPath': newFull } },
            ).exec().catch(() => {});
          }
        } catch (renameErr: any) {
          // Bỏ qua nếu file đang bị lock
        }
      }
    }

    if (foundDir && mailPl01Pdf && mailPl01Pdf.fileName && !mailPl01Pdf.fileName.includes('(Kèm PL01)')) {
      const oldName = mailPl01Pdf.fileName;
      const oldFull = path.join(foundDir, oldName);
      const isAlreadyStandard = oldName.startsWith(`${code} - Phụ lục`) || oldName.startsWith(`${code}_PhuLuc`);
      if (!isAlreadyStandard && fs.existsSync(oldFull)) {
        const standardPlName = `${code} - Phụ lục ACM.pdf`;
        const newFull = path.join(foundDir, standardPlName);
        try {
          fs.renameSync(oldFull, newFull);
          mailPl01Pdf = buildFileObj(standardPlName, 'MAIL_PL01');
          if (record?._id) {
            this.cleanRecordModel.updateOne(
              { _id: record._id },
              { $set: { 'phuLuc.localPath': newFull } },
            ).exec().catch(() => {});
          }
        } catch (renameErr: any) {}
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

    // Nếu hồ sơ có yêu cầu ACM mà chưa có file PL01 riêng nhưng có HĐ gộp (_All.pdf hoặc HĐ kèm PL)
    if (
      !mailPl01Pdf &&
      mailContractPdf &&
      (mailContractPdf.fileName.toLowerCase().includes('all') ||
        (record as any)?.phuLuc?.soHopDongGoc ||
        (record as any)?.phuLuc?.chuKy ||
        record?.noiDungMail?.hasACMRequest ||
        (record as any)?.accountTypes?.includes('ACM'))
    ) {
      mailPl01Pdf = {
        ...mailContractPdf,
        subType: 'MAIL_PL01',
        fileName: `${mailContractPdf.fileName} (Kèm PL01)`,
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
