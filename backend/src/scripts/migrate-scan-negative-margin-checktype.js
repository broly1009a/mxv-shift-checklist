/**
 * Migration: Đổi botCheckType của task ops_open_04_s4
 * Từ: CHECK_PRE_EOD  →  SCAN_NEGATIVE_MARGIN
 *
 * Chạy: node src/scripts/migrate-scan-negative-margin-checktype.js
 */
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function migrate() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();

    // 1. Cập nhật trong collection 'checklist_templates' (template gốc)
    const templatesResult = await db.collection('checklist_templates').updateMany(
      { 'subtasks.taskId': 'ops_open_04_s4', 'subtasks.botCheckType': 'CHECK_PRE_EOD' },
      { $set: { 'subtasks.$[elem].botCheckType': 'SCAN_NEGATIVE_MARGIN' } },
      { arrayFilters: [{ 'elem.taskId': 'ops_open_04_s4' }] },
    );
    console.log(`[checklist_templates] Đã cập nhật ${templatesResult.modifiedCount} template(s).`);

    // 2. Cập nhật trong collection 'shift_logs' (snapshot của từng ca)
    //    Field name là 'botCheckTypeSnapshot' trong mảng 'details'
    const shiftLogsResult = await db.collection('shift_logs').updateMany(
      {
        'details.taskId': 'ops_open_04_s4',
        'details.botCheckTypeSnapshot': 'CHECK_PRE_EOD',
      },
      { $set: { 'details.$[elem].botCheckTypeSnapshot': 'SCAN_NEGATIVE_MARGIN' } },
      { arrayFilters: [{ 'elem.taskId': 'ops_open_04_s4' }] },
    );
    console.log(`[shift_logs] Đã cập nhật ${shiftLogsResult.modifiedCount} shift log(s).`);

    console.log('\n✅ Migration hoàn thành.');
  } catch (err) {
    console.error('❌ Migration thất bại:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrate();
