const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Đọc cấu hình từ file .env
dotenv.config({ path: path.join(__dirname, '.env') });

const mongodbUri = process.env.MONGODB_URI;

if (!mongodbUri) {
  console.error('❌ Không tìm thấy MONGODB_URI trong file .env!');
  process.exit(1);
}

console.log('🔄 Đang kết nối tới database...');
mongoose.connect(mongodbUri)
  .then(async () => {
    console.log('✅ Kết nối database thành công.');
    
    const db = mongoose.connection.db;
    const collection = db.collection('shift_logs');
    
    console.log('🔄 Đang đóng tất cả các ca trực PENDING...');
    const result = await collection.updateMany(
      { status: 'PENDING' },
      { $set: { status: 'COMPLETED', closedAt: new Date() } }
    );
    
    console.log(`✅ Thành công! Đã đóng ${result.modifiedCount} ca trực đang hoạt động.`);
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Lỗi kết nối:', err.message);
    process.exit(1);
  });
