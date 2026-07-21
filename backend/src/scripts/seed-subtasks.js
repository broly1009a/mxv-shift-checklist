/**
 * Seed Sub-tasks vào Checklist Templates
 * Phân loại: Bot 100% (không thêm sub-task) | Bot+Maker (có sub-task) | Thủ công (sub-task toàn Maker)
 *
 * Chạy: node src/scripts/seed-subtasks.js
 */
const { MongoClient, ObjectId } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

// ============================================================
// Định nghĩa sub-tasks cho từng taskId cha
// Quy tắc:
//   isBotCheck: true  → bot tự check, Maker KHÔNG cần checkbox
//   isBotCheck: false → Maker phải checkbox thủ công
// ============================================================
const SUBTASK_DEFINITIONS = {

  // ── OPEN SESSION ──────────────────────────────────────────

  'ops_open_01': { // Kiểm tra Job Snapshot → 🤝 Bot+Maker
    children: [
      { id: 'ops_open_01_s1', name: 'Bot kiểm tra email "Job Snapshot" trong Inbox', isBotCheck: true, botCheckType: 'EMAIL_PARSE', priority: 'HIGH' },
      { id: 'ops_open_01_s2', name: 'Bot gửi cảnh báo Telegram nếu không có email thành công', isBotCheck: true, botCheckType: 'EMAIL_PARSE', priority: 'MEDIUM' },
      { id: 'ops_open_01_s3', name: 'Maker xác nhận đã đọc kết quả (OK → tick; FAILED → ghi nhận đã liên hệ Newgen)', isBotCheck: false, priority: 'HIGH' },
    ],
  },

  'ops_open_02': { // Kiểm tra EOD OMS & MM OMS → 🤝 Bot+Maker
    children: [
      { id: 'ops_open_02_s1', name: 'Bot tải báo cáo CQG CAST Balances (Accounts_Balances.xlsx)', isBotCheck: true, botCheckType: 'RPA_DOWNLOAD_CAST', priority: 'HIGH' },
      { id: 'ops_open_02_s2', name: 'Bot tải báo cáo M-System đầu ngày (QLTKGD, NR, DSTKGD-*)', isBotCheck: true, botCheckType: 'RPA_DOWNLOAD', priority: 'HIGH' },
      { id: 'ops_open_02_s3', name: 'Maker kiểm tra kết quả EOD CCP/CE và xác nhận', isBotCheck: false, priority: 'HIGH' },
      { id: 'ops_open_02_s4', name: 'Maker xác nhận lệnh MM đã lên CCP/CE', isBotCheck: false, priority: 'HIGH' },
    ],
  },

  'TASK_CHECK_EOD': { // Đối chiếu & Chạy EOD MS → 🤝 Bot + Maker
    children: [
      { id: 'TASK_CHECK_EOD_sb1', name: 'Bot kiểm tra & xác minh email kết quả EOD M-System SUCCESS (m-system@mxv.vn)', isBotCheck: true, botCheckType: 'EMAIL_PARSE', priority: 'HIGH' },
      { id: 'TASK_CHECK_EOD_sb2', name: 'Bot tự động chạy đối chiếu dữ liệu 3 bên (M-System vs CQG vs ACM)', isBotCheck: true, botCheckType: 'CHECK_PRE_EOD', priority: 'HIGH' },
      { id: 'TASK_CHECK_EOD_s1', name: 'Maker đối chiếu dữ liệu M-System vs CQG vs ACM', isBotCheck: false, priority: 'CRITICAL' },
      { id: 'TASK_CHECK_EOD_s2', name: 'Maker xác nhận Settlement Price chính xác', isBotCheck: false, priority: 'CRITICAL' },
      { id: 'TASK_CHECK_EOD_s3', name: 'Maker chạy EOD thủ công trên M-System (Newgen)', isBotCheck: false, priority: 'CRITICAL' },
      { id: 'TASK_CHECK_EOD_s4', name: 'Maker ghi nhận kết quả EOD (thành công / thất bại)', isBotCheck: false, priority: 'HIGH' },
    ],
  },

  'ops_open_04': { // Xử lý sau EOD → 🤝 Bot+Maker
    children: [
      { id: 'ops_open_04_s1', name: 'Bot scan & tải bổ sung file backup M-System', isBotCheck: true, botCheckType: 'FILE_AUDIT_MS', priority: 'HIGH' },
      { id: 'ops_open_04_s2', name: 'Bot scan & kiểm tra file backup CQG', isBotCheck: true, botCheckType: 'FILE_AUDIT_CQG', priority: 'HIGH' },
      { id: 'ops_open_04_s3', name: 'Bot scan & kiểm tra file backup ACM (ưu tiên cao)', isBotCheck: true, botCheckType: 'FILE_AUDIT_ACM', priority: 'CRITICAL' },
      { id: 'ops_open_04_s4', name: 'Bot phân tích danh sách TKGD âm ký quỹ & gửi cảnh báo Telegram', isBotCheck: true, botCheckType: 'CHECK_PRE_EOD', priority: 'CRITICAL' },
      { id: 'ops_open_04_s5', name: 'Maker xác nhận đã nhận cảnh báo âm ký quỹ và theo dõi xử lý', isBotCheck: false, priority: 'HIGH' },
    ],
  },

  'ops_open_05': { // SOD → 🔴 Thủ công hoàn toàn
    children: [
      { id: 'ops_open_05_s1', name: 'Maker thực hiện Start of Day (SOD) trên M-System', isBotCheck: false, priority: 'CRITICAL' },
      { id: 'ops_open_05_s2', name: 'Maker xác nhận SOD thành công', isBotCheck: false, priority: 'CRITICAL' },
      { id: 'ops_open_05_s3', name: 'Nếu lỗi: Maker phối hợp Newgen và chạy lại', isBotCheck: false, priority: 'HIGH' },
    ],
  },

  'TASK_CHECK_CQG': { // Sync CQG → 🤝 Bot+Maker
    children: [
      { id: 'TASK_CHECK_CQG_s1', name: 'Bot đối chiếu số dư SOD: M-System vs CQG và gửi báo cáo Telegram', isBotCheck: true, botCheckType: 'AUTO_CHECK_SOD', priority: 'HIGH' },
      { id: 'TASK_CHECK_CQG_s2', name: 'Maker kiểm tra CQG Cast đã reset xong chưa', isBotCheck: false, priority: 'HIGH' },
      { id: 'TASK_CHECK_CQG_s3', name: 'Maker nhấn Sync CQG Cast thủ công và xác nhận thành công', isBotCheck: false, priority: 'CRITICAL' },
    ],
  },

  // TASK_MARGIN_CHECK: isBotCheck=true → Bot 100%, KHÔNG thêm sub-task

  'ops_open_07': { // Gửi Sao kê TKGD → 🤝 Bot+Maker
    children: [
      { id: 'ops_open_07_s1', name: 'Maker trigger gửi email sao kê trên M-System', isBotCheck: false, priority: 'HIGH' },
      { id: 'ops_open_07_s2', name: 'Bot xác minh lịch sử gửi email sao kê & cảnh báo nếu có lỗi', isBotCheck: true, botCheckType: 'EMAIL_STATUS_CHECK', priority: 'HIGH' },
      { id: 'ops_open_07_s3', name: 'Maker xác nhận đã gửi sao kê thành công toàn bộ TKGD', isBotCheck: false, priority: 'HIGH' },
    ],
  },

  // ── DURING SESSION ────────────────────────────────────────

  'ops_during_01': { // Thay đổi ký quỹ → 🔴 Maker-Checker
    children: [
      { id: 'ops_during_01_s1', name: 'Maker (Ca 1) tạo bản ghi thay đổi ký quỹ: điền mã HH, ký quỹ cũ/mới, phiên hiệu lực', isBotCheck: false, priority: 'CRITICAL' },
      { id: 'ops_during_01_s2', name: 'Checker (Ca 2 / Trưởng BP) kiểm tra và phê duyệt bản ghi', isBotCheck: false, priority: 'CRITICAL' },
    ],
  },

  'TASK_CHECK_KLGD': { // Giám sát & Đối chiếu định kỳ → 🤝 Bot+Maker
    children: [
      { id: 'TASK_CHECK_KLGD_s1', name: 'Bot so sánh M-System vs CQG và gửi kết quả Telegram', isBotCheck: true, botCheckType: 'AUTO_CHECK_SOD', priority: 'HIGH' },
      { id: 'TASK_CHECK_KLGD_s2', name: 'Maker xem kết quả đối chiếu (nếu lệch → ghi nhận đã điều tra và xử lý)', isBotCheck: false, priority: 'HIGH' },
    ],
  },

  'ops_during_03': { // Mở hợp đồng mới → 🔴 Thủ công
    children: [
      { id: 'ops_during_03_s1', name: 'Maker thiết lập Futures, Spreads, ACM trên M-System', isBotCheck: false, priority: 'HIGH' },
      { id: 'ops_during_03_s2', name: 'Maker cấu hình hợp đồng tương ứng trên CQG Cast', isBotCheck: false, priority: 'HIGH' },
      { id: 'ops_during_03_s3', name: 'Maker xác nhận không mở quá 1 năm từ hiện tại', isBotCheck: false, priority: 'MEDIUM' },
    ],
  },

  'ops_during_04': { // Xử lý sự cố → 🔴 Thủ công
    children: [
      { id: 'ops_during_04_s1', name: 'Maker tiếp nhận TVKD và tạo ticket Incident (trong 15 phút)', isBotCheck: false, priority: 'CRITICAL' },
      { id: 'ops_during_04_s2', name: 'Maker thông báo Newgen & CNTT (trong 5 phút từ khi phát hiện lỗi)', isBotCheck: false, priority: 'CRITICAL' },
      { id: 'ops_during_04_s3', name: 'Maker gửi email thông báo sự cố cho ĐVNV & TVKD (trong 10 phút)', isBotCheck: false, priority: 'HIGH' },
      { id: 'ops_during_04_s4', name: 'Maker cập nhật Báo cáo lỗi giao dịch Mẫu 01/QT/TVH', isBotCheck: false, priority: 'HIGH' },
    ],
  },

  'ops_during_05': { // Tất toán hợp đồng → 🤝 Bot+Maker
    children: [
      { id: 'ops_during_05_s1', name: 'Bot tính mốc đáo hạn & gửi thông báo nhắc nhở TVKD tự động', isBotCheck: true, botCheckType: 'NOTIFY_MATURITY', priority: 'HIGH' },
      { id: 'ops_during_05_s2', name: 'Maker xác nhận đã gửi thông báo và theo dõi phản hồi TVKD', isBotCheck: false, priority: 'HIGH' },
      { id: 'ops_during_05_s3', name: 'Nếu TVKD không tự xử lý: Maker hủy lệnh chờ & force close vị thế', isBotCheck: false, priority: 'CRITICAL' },
    ],
  },

  'TASK_CCP_STATISTICS': { // Báo cáo CCP → 🤝 Bot+Maker
    children: [
      { id: 'TASK_CCP_STATISTICS_s1', name: 'Bot chạy macro thống kê số lô & giá trị giao dịch (DSGD, TTM, TTTT)', isBotCheck: true, botCheckType: 'RUN_MACRO', priority: 'HIGH' },
      { id: 'TASK_CCP_STATISTICS_s2', name: 'Maker gửi file báo cáo lên nhóm Whatsapp Ban giám sát', isBotCheck: false, priority: 'HIGH' },
      { id: 'TASK_CCP_STATISTICS_s3', name: 'Maker xác nhận đã gửi thành công', isBotCheck: false, priority: 'MEDIUM' },
    ],
  },

  // ── CLOSE SESSION ─────────────────────────────────────────

  'ops_close_01': { // Backup cuối phiên → 🤝 Bot+Maker
    children: [
      { id: 'ops_close_01_s1', name: 'Bot scan & kiểm tra file backup ACM (ưu tiên cao nhất)', isBotCheck: true, botCheckType: 'FILE_AUDIT_ACM', priority: 'CRITICAL' },
      { id: 'ops_close_01_s2', name: 'Bot scan & kiểm tra file backup CE/CCP', isBotCheck: true, botCheckType: 'FILE_AUDIT_CQG', priority: 'CRITICAL' },
      { id: 'ops_close_01_s3', name: 'Bot scan & tải bổ sung file backup M-System', isBotCheck: true, botCheckType: 'FILE_AUDIT_MS', priority: 'HIGH' },
      { id: 'ops_close_01_s4', name: 'Bot chạy macro tổng hợp số lô & giá trị giao dịch cuối phiên', isBotCheck: true, botCheckType: 'RUN_MACRO', priority: 'HIGH' },
      { id: 'ops_close_01_s5', name: 'Maker xác nhận ACM & CE đã backup thành công (bắt buộc trước hệ thống khác)', isBotCheck: false, priority: 'CRITICAL' },
      { id: 'ops_close_01_s6', name: 'Maker xác nhận toàn bộ file M-System và báo cáo cuối phiên đầy đủ', isBotCheck: false, priority: 'HIGH' },
    ],
  },
};

// ============================================================
async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  console.log('✅ Connected to MongoDB\n');

  const db = client.db('mxv_shift_checklist');
  const col = db.collection('checklist_templates');

  const templates = await col.find({}).toArray();
  console.log(`Found ${templates.length} templates\n`);

  for (const tmpl of templates) {
    const parentTasksOnly = (tmpl.tasks || []).filter(t => !t.parentTaskId);

    const newTasks = [];
    let sortOrder = 0;

    for (const task of parentTasksOnly) {
      const def = SUBTASK_DEFINITIONS[task.taskId];

      // Push task cha (giữ nguyên, tăng sortOrder)
      newTasks.push({ ...task, sortOrder: sortOrder++ });

      if (!def) {
        // Bot 100% hoặc không cần sub-task → giữ nguyên, không thêm gì
        continue;
      }

      // Thêm sub-tasks con
      for (const child of def.children) {
        newTasks.push({
          taskId: child.id,
          taskName: child.name,
          priority: child.priority || task.priority || 'MEDIUM',
          sortOrder: sortOrder++,
          isBotCheck: child.isBotCheck,
          botCheckType: child.botCheckType || '',
          botTriggerTime: '',
          botCheckTarget: '',
          botSuccessCondition: '',
          botFailureAction: '',
          parentTaskId: task.taskId,
          dependsOnTaskIds: [],
          sessionType: task.sessionType || tmpl.sessionType || null,
          triggerTime: null,
          slaDeadline: null,
          slaWindowStart: null,
          slaWindowEnd: null,
          slaType: 'FIXED_TIME',
          actionDescription: child.name,
          exceptionCode: '',
          frequencyMinutes: null,
          recurrenceGroupId: '',
          functionUrl: task.functionUrl || '',
          urdReference: task.urdReference || '',
          fileLocation: '',
          timetable: '',
          deadline: task.deadline || null,
        });
      }
    }

    await col.updateOne(
      { _id: tmpl._id },
      { $set: { tasks: newTasks } }
    );

    const added = newTasks.length - parentTasksOnly.length;
    console.log(`✅ Updated "${tmpl.title}": ${parentTasksOnly.length} → ${newTasks.length} tasks (+${added} sub-tasks)`);
  }

  await client.close();
  console.log('\n🎉 Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
