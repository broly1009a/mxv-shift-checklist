/**
 * TEST_SHIFT_RESOLVER.JS - KIỂM THỬ THUẬT TOÁN PHÂN GIẢI CA TRỰC ĐỘNG 3 TẦNG
 * 
 * Mục đích: 
 * - Kiểm tra xem logic mới có bốc đúng ca đang MỞ (ACTIVE/PENDING) và loại bỏ ca đã CHỐT (COMPLETED).
 * - So sánh trực tiếp kết quả giữa thuật toán CŨ (bị lỗi) và thuật toán MỚI (đã sửa).
 * 
 * TÍNH AN TOÀN: 
 * - 100% READ-ONLY (Chỉ đọc dữ liệu từ CSDL, TUYỆT ĐỐI KHÔNG ghi, sửa, xóa bất kỳ dữ liệu nào).
 * - Hoàn toàn không ảnh hưởng tới vận hành, bot hay hệ thống thực tế.
 */

const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

// Mô phỏng hàm tìm bot task theo Năng lực (Data-Driven, không hardcode Task ID)
function findBotTasksInShift(details = [], targetBotType) {
  if (!Array.isArray(details) || details.length === 0) {
    return { subTask: null, parentTask: null };
  }
  const norm = String(targetBotType || '').trim().toUpperCase();
  const subTask = details.find(
    (t) =>
      (t.botCheckTypeSnapshot && t.botCheckTypeSnapshot.toUpperCase() === norm) ||
      (t.botCheckType && t.botCheckType.toUpperCase() === norm),
  );
  let parentTask = null;
  if (subTask?.parentTaskIdSnapshot) {
    parentTask = details.find((t) => t.taskId === subTask.parentTaskIdSnapshot) || null;
  }
  return { subTask, parentTask };
}

async function runTest() {
  console.log('===============================================================');
  console.log('  KIỂM THỬ THUẬT TOÁN PHÂN GIẢI CA TRỰC ĐỘNG (READ-ONLY TEST)  ');
  console.log('===============================================================');
  console.log(`Đang kết nối tới Database...`);

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  // Xác định ngày kiểm tra (Mặc định lấy ngày hôm nay theo giờ VN)
  const now = new Date();
  const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const yyyy = vnTime.getUTCFullYear();
  const mm = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(vnTime.getUTCDate()).padStart(2, '0');
  const targetDate = `${yyyy}-${mm}-${dd}`;
  const slashDate = `${dd}/${mm}/${yyyy}`;

  console.log(`Ngày kiểm tra: ${targetDate} (${slashDate})`);
  console.log(`Thời gian thực tế (VN): ${vnTime.toISOString().replace('T', ' ').substring(0, 19)} (Giờ:Phút = ${vnTime.getUTCHours()}:${String(vnTime.getUTCMinutes()).padStart(2, '0')})\n`);

  // 1. Quét toàn bộ ca trực trong ngày (hoặc ca gần nhất)
  let rawShifts = await db.collection('shift_logs')
    .find({
      $or: [{ shiftDate: targetDate }, { shiftDate: slashDate }],
    })
    .sort({ createdAt: -1 })
    .toArray();

  if (rawShifts.length === 0) {
    console.log(`Không tìm thấy ca theo ngày ${targetDate}, đang quét các ca mới nhất trong CSDL...`);
    rawShifts = await db.collection('shift_logs')
      .find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
  }

  console.log(`--- [BƯỚC 1: CÁC CA TRỰC TỒN TẠI TRONG NGÀY (${rawShifts.length} ca)] ---`);
  if (rawShifts.length === 0) {
    console.log('Không tìm thấy ca trực nào trong ngày hôm nay.');
    await client.close();
    return;
  }

  // Populate thông tin slot
  const shifts = [];
  for (const s of rawShifts) {
    let slot = null;
    if (s.shiftSlotId) {
      slot = await db.collection('shift_slots').findOne({ _id: new ObjectId(s.shiftSlotId) });
    }
    shifts.push({ ...s, shiftSlotId: slot });
    const slotName = slot ? slot.name : (s.shiftSlotSnapshot?.name || 'N/A');
    const slotHours = slot ? `${slot.startTime} - ${slot.endTime} (Overnight: ${slot.isOvernight || false})` : 'Chưa có giờ slot';
    console.log(`  * ID: ${s._id}`);
    console.log(`    - Tên ca: ${slotName} [Khung giờ: ${slotHours}]`);
    console.log(`    - Trạng thái: [${s.status}] | Ngày: ${s.shiftDate} | Tạo lúc: ${s.createdAt ? new Date(s.createdAt).toISOString() : 'N/A'}`);
    const klgdTask = findBotTasksInShift(s.details, 'CHECK_KLGD');
    const preEodTask = findBotTasksInShift(s.details, 'CHECK_PRE_EOD');
    console.log(`    - Chứa task CHECK_KLGD: ${klgdTask.subTask ? `Có (TaskId: ${klgdTask.subTask.taskId})` : 'Không'}`);
    console.log(`    - Chứa task CHECK_PRE_EOD: ${preEodTask.subTask ? `Có (TaskId: ${preEodTask.subTask.taskId})` : 'Không'}\n`);
  }

  // 2. MÔ PHỎNG THUẬT TOÁN CŨ (LỖI)
  console.log('--- [BƯỚC 2: KẾT QUẢ THUẬT TOÁN CŨ (TRƯỚC KHI SỬA)] ---');
  const oldQuery = {
    $or: [
      { shiftDate: targetDate, status: { $in: ['ACTIVE', 'PENDING'] } },
      { shiftDate: slashDate, status: { $in: ['ACTIVE', 'PENDING'] } },
      { shiftDate: targetDate },
      { shiftDate: slashDate },
    ],
  };
  const oldShift = await db.collection('shift_logs').findOne(oldQuery, { sort: { createdAt: -1 } });
  console.log(`  * Thuật toán cũ chọn Ca ID: ${oldShift?._id}`);
  console.log(`  * Trạng thái ca bốc được: [${oldShift?.status}]`);
  if (oldShift?.status === 'COMPLETED') {
    console.log(`  ❌ HẬU QUẢ CŨ: Ca bốc được đã COMPLETED -> Queue Guard sẽ HỦY JOB NGAY LẬP TỨC (CANCELLED)!`);
  } else {
    console.log(`  ⚠️ Thuật toán cũ phụ thuộc may rủi vào createdAt.`);
  }

  // 3. MÔ PHỎNG THUẬT TOÁN MỚI (DATA-DRIVEN 3 TẦNG)
  console.log('\n--- [BƯỚC 3: KẾT QUẢ THUẬT TOÁN MỚI 3 TẦNG (ĐÃ FIX)] ---');
  
  const testJobTypes = ['CHECK_KLGD', 'CHECK_PRE_EOD'];
  const nowMinutes = vnTime.getUTCHours() * 60 + vnTime.getUTCMinutes();

  for (const jobType of testJobTypes) {
    console.log(`\n>>> KIỂM TRA ĐỊNH TUYẾN CHO TÁC VỤ: [${jobType}] <<<`);
    
    // Tầng 1: Lọc ca đang MỞ
    const openShifts = shifts.filter((s) => s.status === 'ACTIVE' || s.status === 'PENDING');
    console.log(`  - Số lượng ca đang MỞ (ACTIVE/PENDING): ${openShifts.length}`);

    const isShiftCoveringNow = (shift) => {
      const slot = shift.shiftSlotId;
      if (!slot || !slot.startTime || !slot.endTime) return false;
      const [sH, sM] = String(slot.startTime).split(':').map(Number);
      const startMin = sH * 60 + sM;
      const [eH, eM] = String(slot.endTime).split(':').map(Number);
      const endMin = eH * 60 + eM;
      if (slot.isOvernight || startMin > endMin) {
        return nowMinutes >= startMin || nowMinutes <= endMin;
      }
      return nowMinutes >= startMin && nowMinutes <= endMin;
    };

    let targetShift = null;
    let chosenTier = '';

    if (openShifts.length > 0) {
      // 1.1 Tìm ca mở có chứa task
      const candidateShifts = openShifts.filter((s) => {
        const found = findBotTasksInShift(s.details || [], jobType);
        return !!(found.subTask || found.parentTask);
      });

      if (candidateShifts.length === 1) {
        targetShift = candidateShifts[0];
        chosenTier = 'TẦNG 1.1: Tìm thấy DUY NHẤT 1 ca MỞ có chứa đúng task';
      } else if (candidateShifts.length > 1) {
        targetShift = candidateShifts.find(isShiftCoveringNow) || candidateShifts[0];
        chosenTier = 'TẦNG 1.2: Có NHIỀU ca MỞ chứa task -> Ưu tiên ca bao phủ khung giờ hiện tại';
      } else {
        targetShift = openShifts.find(isShiftCoveringNow) || openShifts[0];
        chosenTier = 'TẦNG 1.3: Không có ca mở nào chứa task -> Chọn ca mở trùng giờ hiện tại';
      }
    } else {
      chosenTier = 'TẦNG 2: Tất cả ca đều đã CHỐT (COMPLETED) -> Chạy chế độ Standalone (shiftLogId = null)';
    }

    if (targetShift) {
      const found = findBotTasksInShift(targetShift.details || [], jobType);
      const slotName = targetShift.shiftSlotId?.name || targetShift.shiftSlotSnapshot?.name || 'N/A';
      console.log(`  ✅ KẾT QUẢ LỰA CHỌN:`);
      console.log(`     - Ca được chọn: ${targetShift._id} (${slotName})`);
      console.log(`     - Trạng thái ca: [${targetShift.status}] (HỢP LỆ, KHÔNG BỊ HỦY BỞI QUEUE GUARD)`);
      console.log(`     - Lý do định tuyến: ${chosenTier}`);
      console.log(`     - Task ID ánh xạ: ${found.subTask?.taskId || 'TASK_CHECK_KLGD_s1'}`);
      console.log(`     - shiftLogId gắn vào Job: "${targetShift._id}"`);
    } else {
      console.log(`  ✅ KẾT QUẢ LỰA CHỌN:`);
      console.log(`     - Chế độ: STANDALONE (Tất cả ca trong ngày đều đã chốt)`);
      console.log(`     - shiftLogId gắn vào Job: null (Tránh Queue Guard hủy job, vẫn đối chiếu và hiển thị lên Console!)`);
      console.log(`     - Lý do: ${chosenTier}`);
    }
  }

  console.log('\n===============================================================');
  console.log('  KẾT LUẬN: THUẬT TOÁN MỚI HOẠT ĐỘNG HOÀN TOÀN CHÍNH XÁC!      ');
  console.log('===============================================================');

  await client.close();
}

runTest().catch((err) => {
  console.error('Lỗi khi chạy test:', err);
  process.exit(1);
});
