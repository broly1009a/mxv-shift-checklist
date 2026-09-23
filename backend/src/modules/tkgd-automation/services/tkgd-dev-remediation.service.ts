import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as ExcelJS from 'exceljs';
import type { Response } from 'express';
import { CleanAccountRecord, CleanAccountRecordDocument } from '../../../schemas/clean-account-record.schema';
import { TkgdAutomationService } from '../tkgd-automation.service';

export interface RemediationLogItem {
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  message: string;
}

export interface RemediationResultItem {
  accountCode: string;
  customerName: string;
  previousStatus: string;
  newStatus: string;
  previousErrors: string[];
  newErrors: string[];
  statusChanged: boolean;
}

export interface RemediationSession {
  sessionId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  finishedAt?: string;
  total: number;
  current: number;
  currentCode?: string;
  options: {
    crawlMSystem: boolean;
    reparseOcr: boolean;
    reconcileRules: boolean;
    batchDate?: string;
  };
  summary: {
    total: number;
    fixedToKhop: number;
    stillAnomalies: number;
    failed: number;
  };
  logs: RemediationLogItem[];
  results: RemediationResultItem[];
}

export class RemediationOptionsDto {
  crawlMSystem?: boolean;
  reparseOcr?: boolean;
  reconcileRules?: boolean;
  batchDate?: string;
}

export class StartRemediationDto {
  accountCodes?: string[];
  targetAllAnomalies?: boolean;
  options?: RemediationOptionsDto;
}

@Injectable()
export class TkgdDevRemediationService {
  private readonly logger = new Logger(TkgdDevRemediationService.name);
  private sessions: Map<string, RemediationSession> = new Map();

  constructor(
    @InjectModel(CleanAccountRecord.name)
    private readonly cleanRecordModel: Model<CleanAccountRecordDocument>,
    @Inject(forwardRef(() => TkgdAutomationService))
    private readonly tkgdService: TkgdAutomationService,
  ) {}

  /**
   * Khởi động một phiên tái thẩm định / khắc phục bug cho Dev
   */
  async startRemediation(dto: StartRemediationDto, userEmail: string): Promise<{ sessionId: string }> {
    const sessionId = `dev_rem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowStr = new Date().toLocaleTimeString('vi-VN');

    const options = {
      crawlMSystem: dto.options?.crawlMSystem !== false,
      reparseOcr: dto.options?.reparseOcr !== false,
      reconcileRules: dto.options?.reconcileRules !== false,
      batchDate: dto.options?.batchDate,
    };

    const session: RemediationSession = {
      sessionId,
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
      total: 0,
      current: 0,
      options,
      summary: {
        total: 0,
        fixedToKhop: 0,
        stillAnomalies: 0,
        failed: 0,
      },
      logs: [
        {
          timestamp: nowStr,
          level: 'INFO',
          message: `[KHOI_DONG] Khoi tao phien khac phuc bug TKGD (Session: ${sessionId}). Nguoi chay: ${userEmail}`,
        },
      ],
      results: [],
    };

    this.sessions.set(sessionId, session);

    // Kích hoạt tiến trình ngầm (Async execution không block client)
    this.executeSessionAsync(sessionId, dto, userEmail).catch((err) => {
      this.logger.error(`[DEV_REMEDIATION] Loi nghiem trong session ${sessionId}: ${err.message}`, err.stack);
      const s = this.sessions.get(sessionId);
      if (s) {
        s.status = 'FAILED';
        s.logs.push({
          timestamp: new Date().toLocaleTimeString('vi-VN'),
          level: 'ERROR',
          message: `[LOI_HE_THONG] Tien trinh bi ngat do loi: ${err.message}`,
        });
      }
    });

    return { sessionId };
  }

  /**
   * Lấy trạng thái và toàn bộ logs thời gian thực của session
   */
  getSessionStatus(sessionId: string): RemediationSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Thực thi ngầm chu trình tái xử lý End-to-End
   */
  private async executeSessionAsync(
    sessionId: string,
    dto: StartRemediationDto,
    userEmail: string,
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const addLog = (level: RemediationLogItem['level'], message: string) => {
      const timestamp = new Date().toLocaleTimeString('vi-VN');
      session.logs.push({ timestamp, level, message });
      this.logger.log(`[DevRemediation][${sessionId}] ${message}`);
    };

    // 1. Xác định danh sách tài khoản mục tiêu
    let targetCodes: string[] = [];

    if (dto.targetAllAnomalies) {
      addLog('INFO', 'Dang truy van MongoDB de lay toan bo cac tai khoan dang mang trang thai LECH / CAN_KIEM_TRA...');
      const query: any = {
        'ketLuan.trangThai': { $in: ['LECH', 'CAN_KIEM_TRA'] },
      };
      if (dto.options?.batchDate) {
        query.batchDate = dto.options.batchDate;
      }

      const records = await this.cleanRecordModel.find(query, { maTKGD: 1, maTKGDBase: 1 }).lean();
      const codeSet = new Set<string>();
      records.forEach((r) => {
        if (r.maTKGD) codeSet.add(r.maTKGD.trim().toUpperCase());
        else if (r.maTKGDBase) codeSet.add(r.maTKGDBase.trim().toUpperCase());
      });
      targetCodes = Array.from(codeSet);
      addLog('INFO', `Tim thay tong cong ${targetCodes.length} tai khoan can tai tham dinh tu CSDL.`);
    } else if (dto.accountCodes && dto.accountCodes.length > 0) {
      const codeSet = new Set<string>();
      dto.accountCodes.forEach((c) => {
        if (typeof c === 'string' && c.trim()) {
          codeSet.add(c.trim().toUpperCase());
        }
      });
      targetCodes = Array.from(codeSet);
      addLog('INFO', `Tiep nhan danh sach yeu cau gom ${targetCodes.length} tai khoan tu client.`);
    }

    if (targetCodes.length === 0) {
      session.status = 'COMPLETED';
      session.finishedAt = new Date().toISOString();
      addLog('WARN', 'Khong tim thay tai khoan nao de xu ly. Phien ket thuc.');
      return;
    }

    session.total = targetCodes.length;
    session.summary.total = targetCodes.length;

    addLog(
      'INFO',
      `Cau hinh chu trinh End-to-End: Cao MS = ${session.options.crawlMSystem ? 'BAT' : 'TAT'}, Reparse OCR = ${session.options.reparseOcr ? 'BAT' : 'TAT'}, Reconcile Rules = BAT.`,
    );

    // 2. Vòng lặp xử lý tuần tự từng tài khoản
    for (let i = 0; i < targetCodes.length; i++) {
      const code = targetCodes[i];
      session.current = i + 1;
      session.currentCode = code;

      addLog('INFO', `------------------------------------------------------------`);
      addLog('INFO', `[${i + 1}/${targetCodes.length}] Bat dau xu ly tai khoan: ${code}`);

      try {
        const baseCode = code.split('-')[0].trim();

        // Lấy dữ liệu trước khi xử lý để ghi vết Before
        const prevRecord = await this.cleanRecordModel
          .findOne({ $or: [{ maTKGD: code }, { maTKGDBase: baseCode }] })
          .lean();

        const previousStatus = prevRecord?.ketLuan?.trangThai || 'CHUA_DOI_SOAT';
        const previousErrors = prevRecord?.ketLuan?.danhSachLoi || [];
        const customerName =
          prevRecord?.ms?.hoVaTen ||
          prevRecord?.canCuoc?.hoVaTen ||
          prevRecord?.hopDong?.hoVaTen ||
          prevRecord?.noiDungMail?.tenTaiKhoan ||
          'Khách hàng';

        // BƯỚC 1: Cào lại M-System mới nhất (nếu bật)
        if (session.options.crawlMSystem) {
          addLog('INFO', `[${code}][M-SYSTEM] Dang goi Bot RPA cao thong tin moi nhat tren web M-System...`);
          try {
            await this.tkgdService.syncMSystemAccounts(userEmail, {
              investorCode: baseCode,
              downloadImages: true,
              batchDate: session.options.batchDate,
            });
            addLog('SUCCESS', `[${code}][M-SYSTEM] Cao M-System thanh cong.`);
          } catch (msErr: any) {
            addLog('WARN', `[${code}][M-SYSTEM] Canh bao khi cao M-System: ${msErr.message}. Tiep tuc cac buoc tiep theo.`);
          }
        }

        // BƯỚC 2: Bóc tách lại OCR từ file gốc (nếu bật)
        if (session.options.reparseOcr) {
          addLog('INFO', `[${code}][PYTHON_OCR] Dang doc lai file anh/PDF goc tu HoSo_DinhKem va goi Python OCR...`);
          try {
            await this.tkgdService.reparseAccount(userEmail, {
              accountCode: code,
              batchDate: session.options.batchDate,
            });
            addLog('SUCCESS', `[${code}][PYTHON_OCR] Boc tach lai file goc va OCR thanh cong.`);
          } catch (ocrErr: any) {
            addLog('WARN', `[${code}][PYTHON_OCR] Canh bao khi chay OCR: ${ocrErr.message}.`);
          }
        }

        // BƯỚC 3: Tái thẩm định theo bộ luật đối soát mới nhất
        addLog('INFO', `[${code}][RECONCILE] Dang ap dung bo luat doi soat moi nhat trong TypeScript...`);
        const updatedRecord = await this.cleanRecordModel.findOne({
          $or: [{ maTKGD: code }, { maTKGDBase: baseCode }],
        });

        if (!updatedRecord) {
          addLog('ERROR', `[${code}] Khong tim thay ban ghi sau khi tai xu ly.`);
          session.summary.failed++;
          continue;
        }

        const { finalStatus, finalErrors } = this.tkgdService.evaluateRecordReconciliation(updatedRecord);
        const now = new Date();

        updatedRecord.ketLuan = {
          trangThai: finalStatus as any,
          danhSachLoi: finalErrors,
          reconciledAt: now,
        };

        await this.cleanRecordModel.updateOne(
          { _id: updatedRecord._id },
          {
            $set: {
              'ketLuan.trangThai': finalStatus,
              'ketLuan.danhSachLoi': finalErrors,
              'ketLuan.reconciledAt': now,
            },
          },
        );

        const statusChanged = previousStatus !== finalStatus;

        if (previousStatus !== 'KHOP' && finalStatus === 'KHOP') {
          session.summary.fixedToKhop++;
          addLog(
            'SUCCESS',
            `[${code}] >> FIX THANH CONG: ${previousStatus} -> KHOP 100%! Da xoa sach ${previousErrors.length} loi cu.`,
          );
        } else if (finalStatus === 'KHOP') {
          addLog('SUCCESS', `[${code}] Ket qua van duy tri KHOP 100%.`);
        } else {
          session.summary.stillAnomalies++;
          addLog(
            'WARN',
            `[${code}] >> VAN CON LECH (${finalStatus}): ${finalErrors.join(' | ') || 'Chua du dieu kien khop'}`,
          );
        }

        session.results.push({
          accountCode: code,
          customerName,
          previousStatus,
          newStatus: finalStatus,
          previousErrors,
          newErrors: finalErrors,
          statusChanged,
        });
      } catch (itemErr: any) {
        session.summary.failed++;
        addLog('ERROR', `[${code}] Loi ngoai le khi xu ly: ${itemErr.message}`);
      }

      // Khoảng nghỉ nhỏ 100ms tránh nghẽn luồng event loop
      await new Promise((r) => setTimeout(r, 100));
    }

    // 3. Hoàn tất toàn bộ session
    session.status = 'COMPLETED';
    session.finishedAt = new Date().toISOString();
    session.currentCode = undefined;

    addLog('INFO', `============================================================`);
    addLog(
      'SUCCESS',
      `TONG KET PHIEN TAI XU LY: Da xu ly ${session.summary.total} tai khoan | Chuyen sang KHOP: ${session.summary.fixedToKhop} ca | Con loi: ${session.summary.stillAnomalies} ca | Gap loi he thong: ${session.summary.failed} ca.`,
    );
  }

  /**
   * Xuất danh sách các tài khoản đang lỗi ra file Excel để làm bộ test mẫu
   */
  async exportAnomaliesExcel(res: Response, userEmail: string, batchDate?: string): Promise<void> {
    const query: any = {
      'ketLuan.trangThai': { $in: ['LECH', 'CAN_KIEM_TRA'] },
    };
    if (batchDate) {
      query.batchDate = batchDate;
    }

    const records = await this.cleanRecordModel.find(query).sort({ batchDate: -1, createdAt: -1 }).lean();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = `MXV TKGD Dev Tool (${userEmail})`;
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Danh Sách Tài Khoản Lỗi');

    sheet.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Mã TKGD', key: 'maTKGD', width: 16 },
      { header: 'Mã Cơ Sở', key: 'maTKGDBase', width: 14 },
      { header: 'Họ và Tên Khách Hàng', key: 'hoTen', width: 26 },
      { header: 'Số CCCD (M-System)', key: 'cccdMs', width: 18 },
      { header: 'Số CCCD (Email/OCR)', key: 'cccdOcr', width: 18 },
      { header: 'Trạng Thái', key: 'trangThai', width: 16 },
      { header: 'Danh Sách Lỗi Chi Tiết', key: 'danhSachLoi', width: 50 },
      { header: 'Ngày Đợt (Batch Date)', key: 'batchDate', width: 15 },
    ];

    // Định dạng tiêu đề Header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    records.forEach((rec, idx) => {
      const cccdMs = rec.ms?.soCMND_HoChieu || '';
      const cccdOcr = rec.canCuoc?.soCanCuoc || rec.hopDong?.soCanCuoc || '';
      const hoTen =
        rec.ms?.hoVaTen ||
        rec.canCuoc?.hoVaTen ||
        rec.hopDong?.hoVaTen ||
        rec.noiDungMail?.tenTaiKhoan ||
        '';
      const errors = (rec.ketLuan?.danhSachLoi || []).join('; ');

      const row = sheet.addRow({
        stt: idx + 1,
        maTKGD: rec.maTKGD || rec.maTKGDBase || '',
        maTKGDBase: rec.maTKGDBase || '',
        hoTen,
        cccdMs,
        cccdOcr,
        trangThai: rec.ketLuan?.trangThai || 'LECH',
        danhSachLoi: errors,
        batchDate: rec.batchDate || '',
      });

      row.alignment = { vertical: 'middle' };
      if (rec.ketLuan?.trangThai === 'LECH') {
        row.getCell('trangThai').font = { color: { argb: 'FFDC2626' }, bold: true };
      } else {
        row.getCell('trangThai').font = { color: { argb: 'FFD97706' }, bold: true };
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="TKGD_Danh_Sach_Loi_${batchDate || 'All'}_${Date.now()}.xlsx"`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}
