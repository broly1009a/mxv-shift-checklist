const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../../dist/app.module');
const { ReconciliationService } = require('../../dist/modules/reconciliation/reconciliation.service');
const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const reconciliationService = app.get(ReconciliationService);

  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const shift = await db.collection('shift_logs').findOne({ status: 'PENDING' });
  if (shift) {
    console.log(`Found active shift ID: ${shift._id}, Date: ${shift.shiftDate}`);
    const targetDate = new Date(shift.shiftDate);
    const reconResult = await reconciliationService.runAutoCheckPreEOD(targetDate);
    console.log('Calculated reconResult totals:', reconResult.totals);

    let note = `[ĐỐI CHIẾU TRƯỚC EOD]\n`;
    if (reconResult.sessionStart && reconResult.checkTime) {
      const startStr = new Date(reconResult.sessionStart).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      const endStr = new Date(reconResult.checkTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      note += `• Khoảng thời gian lọc: từ ${startStr} đến ${endStr}\n`;
    }
    const totals = reconResult.totals || {};
    note += `• Khớp lệnh tự doanh (MS vs Straits): ${totals.totalACM_MS || 0} vs ${totals.totalACM_Straits || 0} lot (Chênh lệch: ${totals.differACM || 0} lot)\n`;
    note += `• Khớp lệnh thường (MS vs CQG): ${totals.totalCQG_MS || 0} vs ${totals.totalCQG_FR || 0} lot (Chênh lệch: ${totals.differCQG || 0} lot)\n`;
    
    const mismatchedPositions = reconResult.mismatchedPositions || [];
    note += `• Chênh lệch vị thế net position (MS vs CQG): ${mismatchedPositions.length} tài khoản\n`;

    const mismatchedTrades = reconResult.mismatchedTrades || [];
    if (mismatchedTrades.length > 0) {
      note += `⚠️ Phát hiện ${mismatchedTrades.length} giao dịch bị lệch chi tiết:\n`;
      mismatchedTrades.slice(0, 10).forEach((m) => {
        note += `  - [${m.source}] TK ${m.maTKGD}, HĐ ${m.maHD}, Giá ${m.giaKhop}, Qty ${m.klGiaoDich}: ${m.reason}\n`;
      });
    }

    const payloadJson = JSON.stringify({
      success: reconResult.passed,
      message: note,
      result: reconResult,
      type: 'PRE_EOD'
    });

    let modified = false;
    shift.details.forEach(d => {
      if (d.taskId === 'TASK_CHECK_KLGD_s1') {
        d.resultNote = payloadJson;
        d.status = reconResult.passed ? 'PASSED' : 'NEEDS_ATTENTION';
        modified = true;
      }
    });

    if (modified) {
      await db.collection('shift_logs').updateOne({ _id: shift._id }, { $set: { details: shift.details } });
      console.log('Successfully updated TASK_CHECK_KLGD_s1 directly in MongoDB with real parsed reconciliation data!');
    }
  }

  await client.close();
  await app.close();
}

main().catch(console.error);
