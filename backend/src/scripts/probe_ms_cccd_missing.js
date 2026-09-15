/**
 * PROBE: Kiểm tra nguyên nhân 195 hồ sơ bị đánh dấu "M-System chưa nhập số CCCD"
 * Mục tiêu: So sánh dữ liệu ms trong DB để xác định scraper có đọc được CCCD hay không
 * 
 * Cách chạy: node backend/src/scripts/probe_ms_cccd_missing.js
 */
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'mxv_tkgd';
const COLL = 'clean_account_records';

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const col = db.collection(COLL);

  console.log('🔍 Đang tra cứu 10 hồ sơ LECH bị đánh dấu "M-System chưa nhập số CCCD"...\n');

  // Lấy 10 hồ sơ LECH có lý do "M-System chưa nhập số CCCD"
  const samples = await col.find({
    'reconciliationResult.status': 'LECH',
    'reconciliationResult.criticalErrors': { $regex: 'chưa nhập số CCCD', $options: 'i' },
  }).limit(10).toArray();

  if (samples.length === 0) {
    console.log('❌ Không tìm thấy hồ sơ nào khớp điều kiện. Kiểm tra lại tên collection hoặc field path.');
    await client.close();
    return;
  }

  console.log(`📦 Tìm thấy ${samples.length} mẫu. Chi tiết:\n`);

  for (const doc of samples) {
    const ms = doc.ms || {};
    const code = doc.maTKGD || '???';
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔑 Mã TKGD   : ${code}`);
    console.log(`   ms.isFoundOnMS      : ${ms.isFoundOnMS}`);
    console.log(`   ms.hoVaTen          : ${ms.hoVaTen || '(trống)'}`);
    console.log(`   ms.tenTKGD          : ${ms.tenTKGD || '(trống)'}`);
    console.log(`   ms.maTKGD           : ${ms.maTKGD || '(trống)'}`);
    console.log(`   ms.soCMND_HoChieu   : "${ms.soCMND_HoChieu || ''}"  ← ĐÂY LÀ GỐC VẤN ĐỀ`);
    console.log(`   ms.cccdOcr_soCanCuoc: ${ms.cccdOcr_soCanCuoc || '(trống)'}`);
    console.log(`   ms.ngaySinh         : ${ms.ngaySinh || '(trống)'}`);
    console.log(`   ms.ngayCap          : ${ms.ngayCap || '(trống)'}`);
    console.log(`   ms.trangThai        : ${ms.trangThai || '(trống)'}`);
    
    // Kiểm tra các field khác trong ms object (có thể scraper lưu vào key tên khác)
    const msKeys = Object.keys(ms);
    const cccdRelatedKeys = msKeys.filter(k => 
      k.toLowerCase().includes('cccd') || 
      k.toLowerCase().includes('cmt') || 
      k.toLowerCase().includes('cmnd') || 
      k.toLowerCase().includes('hoc') ||
      k.toLowerCase().includes('passport')
    );
    if (cccdRelatedKeys.length > 0) {
      console.log(`   ⚠️  Các key ms liên quan CCCD khác: ${JSON.stringify(cccdRelatedKeys)}`);
      for (const k of cccdRelatedKeys) {
        console.log(`      ms.${k} = ${JSON.stringify(ms[k])}`);
      }
    }
    
    // In toàn bộ keys của ms để debug
    console.log(`   📋 Tất cả keys trong ms: [${msKeys.join(', ')}]`);
    console.log();
  }

  // Thống kê: bao nhiêu hồ sơ có ms.hoVaTen nhưng không có ms.soCMND_HoChieu
  const withNameNoId = await col.countDocuments({
    'reconciliationResult.status': 'LECH',
    'reconciliationResult.criticalErrors': { $regex: 'chưa nhập số CCCD', $options: 'i' },
    'ms.hoVaTen': { $exists: true, $ne: '' },
    $or: [
      { 'ms.soCMND_HoChieu': { $exists: false } },
      { 'ms.soCMND_HoChieu': '' },
      { 'ms.soCMND_HoChieu': null },
    ],
  });

  const withNameAndId = await col.countDocuments({
    'reconciliationResult.status': 'LECH',
    'reconciliationResult.criticalErrors': { $regex: 'chưa nhập số CCCD', $options: 'i' },
    'ms.hoVaTen': { $exists: true, $ne: '' },
    'ms.soCMND_HoChieu': { $exists: true, $ne: '' },
  });

  const total = await col.countDocuments({
    'reconciliationResult.status': 'LECH',
    'reconciliationResult.criticalErrors': { $regex: 'chưa nhập số CCCD', $options: 'i' },
  });

  console.log(`\n📊 TỔNG KẾT THỐNG KÊ:`);
  console.log(`   Tổng hồ sơ "M-System chưa nhập số CCCD"          : ${total}`);
  console.log(`   → Có ms.hoVaTen nhưng KHÔNG có ms.soCMND_HoChieu  : ${withNameNoId}  ← SCRAPER BỊ LỖI`);
  console.log(`   → Có cả ms.hoVaTen VÀ ms.soCMND_HoChieu           : ${withNameAndId}  ← (không nên xảy ra)`);
  console.log();
  
  if (withNameNoId > 0) {
    console.log(`💡 KẾT LUẬN: ${withNameNoId}/${total} hồ sơ có tên trên MS nhưng số CCCD bị trống.`);
    console.log(`   → NGUYÊN NHÂN: Playwright selector trong msystem-scraper.helper.ts`);
    console.log(`     input[placeholder="Số CMT/ Hộ chiếu"] không khớp với UI M-System hiện tại.`);
    console.log(`   → GIẢI PHÁP: Cần re-scrape lại với selector được cập nhật.`);
  }

  await client.close();
}

main().catch(console.error);
