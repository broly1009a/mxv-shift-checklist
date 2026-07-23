import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ReconciliationService } from '../modules/reconciliation/reconciliation.service';
import { ShiftsService } from '../modules/shifts/shifts.service';

async function main() {
  console.log('=== RUNNING AUTOMATED PRE-EOD CHECK FOR ACTIVE SHIFT ===');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const reconService = app.get(ReconciliationService);
  const shiftsService = app.get(ShiftsService);

  const tradingDate = new Date('2026-07-22T00:00:00.000Z');
  const shiftLogId = '6a6098904164d087aed41f1b';
  const taskId = 'TASK_CHECK_KLGD_s1';

  try {
    console.log(`Running runAutoCheckPreEOD for date: ${tradingDate.toISOString()}...`);
    const result = await reconService.runAutoCheckPreEOD(tradingDate);
    console.log('Reconciliation result computed successfully.');

    const hasDiscrepancy =
      (result.totals?.differACM || 0) > 0 ||
      (result.totals?.differCQG || 0) > 0 ||
      (result.mismatchedTrades?.length || 0) > 0 ||
      (result.mismatchedPositions?.length || 0) > 0;

    const status = hasDiscrepancy ? 'NEEDS_ATTENTION' : 'PASSED';
    console.log(`Computed status: ${status} (hasDiscrepancy = ${hasDiscrepancy})`);

    // Format the note as JSON exactly like getReconciliationJson for PRE_EOD
    let note = `[ĐỐI CHIẾU TRƯỚC EOD]\n`;
    if (result.sessionStart && result.checkTime) {
      const startStr = new Date(result.sessionStart).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      const endStr = new Date(result.checkTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      note += `• Khoảng thời gian lọc: từ ${startStr} đến ${endStr}\n`;
    }
    const totals = result.totals || {};
    note += `• Khớp lệnh tự doanh (MS vs Straits): ${totals.totalACM_MS || 0} vs ${totals.totalACM_Straits || 0} lot (Chênh lệch: ${totals.differACM || 0} lot)\n`;
    note += `• Khớp lệnh thường (MS vs CQG): ${totals.totalCQG_MS || 0} vs ${totals.totalCQG_FR || 0} lot (Chênh lệch: ${totals.differCQG || 0} lot)\n`;
    
    const mismatchedPositions = result.mismatchedPositions || [];
    note += `• Chênh lệch vị thế net position (MS vs CQG): ${mismatchedPositions.length} tài khoản\n`;

    const mismatchedTrades = result.mismatchedTrades || [];
    if (mismatchedTrades.length > 0) {
      note += `⚠️ Phát hiện ${mismatchedTrades.length} giao dịch bị lệch chi tiết:\n`;
      mismatchedTrades.slice(0, 10).forEach((m: any) => {
        note += `  - [${m.source}] TK ${m.maTKGD}, HĐ ${m.maHD}, Giá ${m.giaKhop}, Qty ${m.klGiaoDich}: ${m.reason}\n`;
      });
      if (mismatchedTrades.length > 10) {
        note += `  - ... và ${mismatchedTrades.length - 10} giao dịch khác.\n`;
      }
    } else {
      note += `✓ Không có lệch chi tiết khớp lệnh.\n`;
    }

    if (mismatchedPositions.length > 0) {
      note += `⚠️ Phát hiện ${mismatchedPositions.length} chênh lệch vị thế ròng (net position) chi tiết:\n`;
      mismatchedPositions.slice(0, 10).forEach((m: any) => {
        note += `  - TK ${m.account}, HĐ ${m.symbol}: MS ${m.msPosition} vs CQG ${m.cqgPosition} (Chênh lệch: ${m.differ})\n`;
      });
      if (mismatchedPositions.length > 10) {
        note += `  - ... và ${mismatchedPositions.length - 10} chênh lệch khác.\n`;
      }
    }

    const payload = JSON.stringify({
      success: !hasDiscrepancy,
      message: note,
      result,
      type: 'PRE_EOD'
    });

    const systemUser = {
      id: '000000000000000000000000',
      fullName: 'Hệ thống tự động (Bot)',
      username: 'system_bot',
      role: 'ADMIN',
    };

    console.log('Updating task status in DB...');
    await shiftsService.updateTaskStatus(
      shiftLogId,
      taskId,
      status,
      systemUser,
      payload,
      true
    );

    console.log('✅ Task status updated successfully!');
  } catch (err: any) {
    console.error('❌ Error executing Pre-EOD active check:', err.message, err.stack);
  } finally {
    await app.close();
  }
}

main().catch(console.error);
