import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ReconciliationService } from './reconciliation.service';
import { ShiftsService } from '../shifts/shifts.service';

@Controller('reconciliation')
export class ReconciliationController {
  private readonly logger = new Logger(ReconciliationController.name);

  constructor(
    private readonly reconciliationService: ReconciliationService,
    private readonly shiftsService: ShiftsService,
  ) {}

  @Post('upload-klgd')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'dsgd', maxCount: 1 },
      { name: 'fr1', maxCount: 1 },
      { name: 'fr2', maxCount: 1 },
      { name: 'nano', maxCount: 1 },
      { name: 'ttm', maxCount: 1 },
      { name: 'op1', maxCount: 1 },
      { name: 'op2', maxCount: 1 },
    ]),
  )
  async uploadAndReconcile(
    @UploadedFiles()
    files: {
      dsgd?: any[];
      fr1?: any[];
      fr2?: any[];
      nano?: any[];
      ttm?: any[];
      op1?: any[];
      op2?: any[];
    },
    @Body('shiftLogId') shiftLogId: string,
    @Body('taskId') taskId: string,
    @Body('tradingDate') tradingDateStr?: string,
  ) {
    if (!shiftLogId || !taskId) {
      throw new BadRequestException('Thiếu shiftLogId hoặc taskId');
    }

    const tradingDate = tradingDateStr ? new Date(tradingDateStr) : new Date();

    const fileBuffers = {
      dsgd: files?.dsgd?.[0]?.buffer,
      fr1: files?.fr1?.[0]?.buffer,
      fr2: files?.fr2?.[0]?.buffer,
      nano: files?.nano?.[0]?.buffer,
      ttm: files?.ttm?.[0]?.buffer,
      op1: files?.op1?.[0]?.buffer,
      op2: files?.op2?.[0]?.buffer,
    };

    if (!fileBuffers.dsgd) {
      throw new BadRequestException('File dsgd (M-System) là bắt buộc để đối chiếu.');
    }

    try {
      const result = await this.reconciliationService.checkKLGD(fileBuffers, tradingDate);

      const systemUser = {
        id: '000000000000000000000000',
        fullName: 'Hệ thống tự động (Bot)',
        username: 'system_bot',
        role: 'ADMIN',
      };

      const hasDiscrepancy =
        result.totals.differ > 0 ||
        result.totals.differACM > 0 ||
        result.mismatchedTrades.length > 0 ||
        result.mismatchedTTM.length > 0;

      const status = hasDiscrepancy ? 'NEEDS_ATTENTION' : 'PASSED';
      
      let note = `[ĐỐI CHIẾU TỰ ĐỘNG]\n`;
      note += `• Khớp lệnh thường (MS vs CQG): ${result.totals.totalDSGD} vs ${result.totals.totalFR} lot (Chênh lệch: ${result.totals.differ} lot)\n`;
      note += `• Khớp lệnh tự doanh (MS vs ACM): ${result.totals.totalACM} vs ${result.totals.totalNano} lot (Chênh lệch: ${result.totals.differACM} lot)\n`;
      
      if (result.mismatchedTrades.length > 0) {
        note += `⚠️ Phát hiện ${result.mismatchedTrades.length} giao dịch bị lệch chi tiết:\n`;
        result.mismatchedTrades.slice(0, 10).forEach(m => {
          note += `  - [${m.source}] TK ${m.maTKGD}, HĐ ${m.maHD}, Giá ${m.giaKhop}, Qty ${m.klGiaoDich}: ${m.reason}\n`;
        });
        if (result.mismatchedTrades.length > 10) {
          note += `  ... và ${result.mismatchedTrades.length - 10} giao dịch khác.\n`;
        }
      } else {
        note += `✓ Không có lệch chi tiết khớp lệnh.\n`;
      }

      if (result.mismatchedTTM.length > 0) {
        note += `⚠️ Phát hiện chênh lệch TTM (Trạng thái mở) tại ${result.mismatchedTTM.length} tài khoản:\n`;
        result.mismatchedTTM.slice(0, 10).forEach(m => {
          note += `  - TK ${m.maTKGD}: MS ${m.ttmValue} vs CQG ${m.opValue} (Lệch: ${m.differ})\n`;
        });
      }

      // Update the checklist task status using ShiftsService
      await this.shiftsService.updateTaskStatus(shiftLogId, taskId, status, systemUser, note);

      return {
        success: !hasDiscrepancy,
        message: hasDiscrepancy ? 'Đối chiếu hoàn thành có chênh lệch.' : 'Đối chiếu hoàn thành khớp hoàn toàn.',
        result,
      };
    } catch (error: any) {
      this.logger.error(`Lỗi đối chiếu upload: ${error.message}`, error.stack);
      throw new BadRequestException(`Lỗi khi xử lý file đối chiếu: ${error.message}`);
    }
  }

  @Post('upload-eod')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'qltkgd', maxCount: 1 },
      { name: 'eod', maxCount: 1 },
      { name: 'tttt', maxCount: 1 },
      { name: 'accountsBalances', maxCount: 1 },
    ]),
  )
  async uploadAndReconcileEOD(
    @UploadedFiles()
    files: {
      qltkgd?: any[];
      eod?: any[];
      tttt?: any[];
      accountsBalances?: any[];
    },
    @Body('shiftLogId') shiftLogId: string,
    @Body('taskId') taskId: string,
    @Body('usdRate') usdRateStr?: string,
  ) {
    if (!shiftLogId || !taskId) {
      throw new BadRequestException('Thiếu shiftLogId hoặc taskId');
    }

    const usdRate = usdRateStr ? parseFloat(usdRateStr) : 25220;

    const fileBuffers = {
      qltkgd: files?.qltkgd?.[0]?.buffer,
      eod: files?.eod?.[0]?.buffer,
      tttt: files?.tttt?.[0]?.buffer,
      accountsBalances: files?.accountsBalances?.[0]?.buffer,
    };

    const systemUser = {
      id: '000000000000000000000000',
      fullName: 'Hệ thống tự động (Bot)',
      username: 'system_bot',
      role: 'ADMIN',
    };

    try {
      // Case A: CQG EOD Balance check (if accountsBalances is uploaded)
      if (fileBuffers.accountsBalances) {
        if (!fileBuffers.qltkgd) {
          throw new BadRequestException('File QLTKGD.xlsx là bắt buộc để đối chiếu số dư CQG.');
        }

        const result = await this.reconciliationService.checkEODCQG({
          qltkgd: fileBuffers.qltkgd,
          accountsBalances: fileBuffers.accountsBalances,
        }, usdRate);

        const hasDiscrepancy = result.length > 0;
        const status = hasDiscrepancy ? 'NEEDS_ATTENTION' : 'PASSED';

        let note = `[ĐỐI CHIẾU SỐ DƯ CQG TỰ ĐỘNG]\n`;
        note += `• Số tài khoản chênh lệch (> 100 USD): ${result.length}\n`;
        if (result.length > 0) {
          note += `⚠️ Danh sách tài khoản lệch:\n`;
          result.slice(0, 10).forEach(r => {
            note += `  - TK ${r.maTKGD}: MS $${r.calculatedBalance} vs CQG $${r.cqgBalance} (Chênh lệch: $${r.differ.toFixed(2)})\n`;
          });
          if (result.length > 10) {
            note += `  ... và ${result.length - 10} tài khoản khác.\n`;
          }
        } else {
          note += `✓ Số dư khớp hoàn toàn giữa M-System và CQG.\n`;
        }

        await this.shiftsService.updateTaskStatus(shiftLogId, taskId, status, systemUser, note);

        return {
          success: !hasDiscrepancy,
          type: 'CQG',
          message: hasDiscrepancy ? 'Đối chiếu số dư CQG có chênh lệch.' : 'Đối chiếu số dư CQG khớp hoàn toàn.',
          result,
        };
      }

      // Case B: M-System EOD Calculation check (if eod and tttt are uploaded)
      if (fileBuffers.eod) {
        if (!fileBuffers.qltkgd) {
          throw new BadRequestException('File QLTKGD.xlsx là bắt buộc để đối chiếu số dư EOD.');
        }
        if (!fileBuffers.tttt) {
          throw new BadRequestException('File TTTT.xlsx là bắt buộc để đối chiếu số dư EOD.');
        }

        const result = await this.reconciliationService.checkEOD({
          qltkgd: fileBuffers.qltkgd,
          eod: fileBuffers.eod,
          tttt: fileBuffers.tttt,
        });

        const hasDiscrepancy = result.mismatchedEOD.length > 0;
        const status = hasDiscrepancy ? 'NEEDS_ATTENTION' : 'PASSED';

        let note = `[ĐỐI CHIẾU EOD TỰ ĐỘNG]\n`;
        note += `• Số tài khoản lệch số dư (>= 1,000đ): ${result.mismatchedEOD.length}\n`;
        note += `• Phát hiện tài khoản âm ký quỹ mới: ${result.negativeIMRAcc.length}\n`;
        
        if (result.mismatchedEOD.length > 0) {
          note += `⚠️ Danh sách tài khoản lệch:\n`;
          result.mismatchedEOD.slice(0, 10).forEach(r => {
            note += `  - TK ${r.maTKGD}: Tính toán ${r.calculatedBalance.toLocaleString()}đ vs EOD ${r.eodBalance.toLocaleString()}đ (Lệch: ${r.differ.toLocaleString()}đ)\n`;
          });
          if (result.mismatchedEOD.length > 10) {
            note += `  ... và ${result.mismatchedEOD.length - 10} tài khoản khác.\n`;
          }
        } else {
          note += `✓ Số dư khớp hoàn toàn giữa M-System và báo cáo EOD.\n`;
        }

        if (result.negativeIMRAcc.length > 0) {
          note += `🚨 Tài khoản âm ký quỹ khả dụng mới: ${result.negativeIMRAcc.join(', ')}\n`;
        }

        await this.shiftsService.updateTaskStatus(shiftLogId, taskId, status, systemUser, note);

        return {
          success: !hasDiscrepancy,
          type: 'EOD',
          message: hasDiscrepancy ? 'Đối chiếu EOD có chênh lệch.' : 'Đối chiếu EOD khớp hoàn toàn.',
          result,
        };
      }

      throw new BadRequestException('Không nhận diện được loại đối chiếu. Vui lòng tải lên đúng bộ tệp tin.');
    } catch (error: any) {
      this.logger.error(`Lỗi đối chiếu EOD/CQG: ${error.message}`, error.stack);
      throw new BadRequestException(`Lỗi khi xử lý file đối chiếu EOD/CQG: ${error.message}`);
    }
  }
}

