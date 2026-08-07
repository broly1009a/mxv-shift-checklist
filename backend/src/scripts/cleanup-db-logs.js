/**
 * Script dọn dẹp các bản ghi nhật ký (logs) cũ trong MongoDB
 * Giúp giải phóng bộ nhớ (Free Space Quota) khi bị tràn 512MB
 *
 * Chạy: node src/scripts/cleanup-db-logs.js
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

const URI = process.env.MONGODB_URI || 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  console.log('✅ Connected to MongoDB');

  const db = client.db('mxv_shift_checklist');

  // Mốc thời gian: Xóa các log cũ hơn 7 ngày
  const daysToKeep = 7;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  console.log(`\n🧹 Tiến hành dọn dẹp các log cũ hơn ngày: ${cutoffDate.toLocaleString()}`);

  const collectionsToClean = [
    { name: 'system_logs', dateField: 'createdAt' },
    { name: 'audit_logs', dateField: 'createdAt' },
    { name: 'activity_logs', dateField: 'createdAt' },
    { name: 'notification_logs', dateField: 'createdAt' }
  ];

  for (const colInfo of collectionsToClean) {
    try {
      const collection = db.collection(colInfo.name);
      
      // Đếm số lượng log trước khi xóa
      const totalBefore = await collection.countDocuments({});
      
      // Thực hiện xóa
      const deleteResult = await collection.deleteMany({
        [colInfo.dateField]: { $lt: cutoffDate }
      });

      const totalAfter = await collection.countDocuments({});

      console.log(`- Collection [${colInfo.name}]:`);
      console.log(`  * Đã xóa: ${deleteResult.deletedCount} bản ghi`);
      console.log(`  * Còn lại: ${totalAfter} / ${totalBefore} bản ghi`);
    } catch (err) {
      console.error(`❌ Lỗi khi dọn dẹp collection "${colInfo.name}":`, err.message);
    }
  }

  await client.close();
  console.log('\n🎉 Hoàn thành dọn dẹp cơ sở dữ liệu!');
}

main().catch(e => {
  console.error('❌ Lỗi thực thi:', e);
  process.exit(1);
});
