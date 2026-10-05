const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const LEAKED_ACCOUNTS = [
  '002C0417188',
  '003C2004616',
  '003C4657915',
  '003C4682648'
];

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27018/mxv_shift_checklist');
  const coll = mongoose.connection.collection('clean_account_records');

  console.log(`\n=== 1. KIỂM TRA & LÀM SẠCH DATABASE CHO CÁC TÀI KHOẢN BỊ NHIỄM GHOST DOM ===`);
  for (const code of LEAKED_ACCOUNTS) {
    const docs = await coll.find({ maTKGD: code }).toArray();
    console.log(`\n🔹 Tài khoản: ${code} (Tìm thấy ${docs.length} bản ghi DB)`);

    for (const d of docs) {
      console.log(`   - ID: ${d._id}, BatchDate: ${d.batchDate}`);
      console.log(`     Tên kỳ vọng: ${d.noiDungMail?.tenTaiKhoan || d.hopDong?.hoVaTen}`);
      console.log(`     Tên MS cũ bị rò rỉ: ${d.ms?.hoVaTen} (CCCD: ${d.ms?.soCMND_HoChieu})`);

      // Reset MS data to clean empty state (waiting for real MS data)
      await coll.updateOne(
        { _id: d._id },
        {
          $set: {
            ms: {
              maTKGD: code,
              isFoundOnMS: false,
              crawledAt: new Date(),
              crawlAttempts: 0,
              rawInputsLog: []
            },
            ketLuan: {
              trangThai: 'CHUA_XU_LY',
              danhSachLoi: ['Tài khoản đang chờ đồng bộ từ M-System'],
              reconciledAt: new Date(),
              needsManualReview: false
            }
          }
        }
      );
      console.log(`     ✅ Đã reset về trạng thái CHUA_XU_LY (Chờ đồng bộ M-System)`);
    }
  }

  console.log(`\n=== 2. KIỂM TRA & XÓA CÁC TỆP ẢNH GHOST _MS_ ĐÃ TẢI SAI TRÊN Ổ M: ===`);
  const baseDir = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD\\HoSo_DinhKem';
  if (fs.existsSync(baseDir)) {
    const dates = fs.readdirSync(baseDir);
    for (const d of dates) {
      const dateDir = path.join(baseDir, d);
      if (!fs.statSync(dateDir).isDirectory()) continue;
      for (const code of LEAKED_ACCOUNTS) {
        const accDir = path.join(dateDir, code);
        if (fs.existsSync(accDir)) {
          const files = fs.readdirSync(accDir);
          for (const f of files) {
            if (f.includes('_MS_')) {
              const fullPath = path.join(accDir, f);
              try {
                fs.unlinkSync(fullPath);
                console.log(`   🗑️ Đã xóa file rò rỉ: ${fullPath}`);
              } catch (e) {
                console.warn(`   ⚠️ Không thể xóa ${fullPath}: ${e.message}`);
              }
            }
          }
        }
      }
    }
  }

  console.log(`\n=== HOÀN TẤT REMEDIATION ===`);
  await mongoose.disconnect();
}

run().catch(console.error);
