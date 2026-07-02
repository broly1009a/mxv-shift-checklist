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
}
