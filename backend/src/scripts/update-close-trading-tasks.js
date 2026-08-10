#!/usr/bin/env node
/**
 * =============================================================================
 * update-close-trading-tasks.js
 * =============================================================================
 * Mục đích:
 *   Cập nhật template "Checklist Đóng Cửa - Trading Operations" trong MongoDB:
 *   Thay thế task cũ ops_close_01_s4 (RUN_MACRO gộp chung cuối phiên) bằng
 *   3 task bot riêng biệt:
 *     - ops_close_01_s4_lot   (RUN_LOT_MACRO  — Thống kê số lốt)
 *     - ops_close_01_s4_value (RUN_VALUE_MACRO — Thống kê giá trị)
 *     - ops_close_01_s4_ccp   (RUN_MACRO       — Báo cáo CCP Pilot Bạc Thỏi)
 *
 * Cách chạy:
 *   Windows : node src/scripts/update-close-trading-tasks.js
 *   Ubuntu  : node src/scripts/update-close-trading-tasks.js
 *
 * Yêu cầu:
 *   - Node.js >= 16
 *   - package mongodb đã được cài (npm install mongodb)
 *   - File .env ở thư mục backend/ có biến MONGODB_URI hoặc set env trực tiếp:
 *       MONGO_URI="mongodb+srv://..." node src/scripts/update-close-trading-tasks.js
 * =============================================================================
 */

'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs');

// ─── Load .env thủ công (không cần dotenv package) ───────────────────────────
function loadEnv() {
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
    console.log(`[ENV] Loaded from: ${envPath}`);
  } else {
    console.warn(`[ENV] .env not found at ${envPath}, using process.env only.`);
  }
}

loadEnv();

// ─── Cấu hình ─────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI
  || process.env.MONGODB_URI
  || 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

const DB_NAME = process.env.MONGO_DB_NAME || 'mxv_shift_checklist';

/**
 * ID của template "Checklist Đóng Cửa - Trading Operations".
 * Giá trị này là _id gốc từ backup ngày 2026-07-15.
 * Nếu restore từ BSON gốc thì ID này vẫn giữ nguyên.
 */
const CLOSE_TEMPLATE_ID = process.env.CLOSE_TEMPLATE_ID || '6a56f1165e8144acc73753b9';

// ─── Định nghĩa 3 task mới ────────────────────────────────────────────────────
const TASK_DEFAULTS = {
  botTriggerTime: '',
  botCheckTarget: '',
  botSuccessCondition: '',
  botFailureAction: '',
  parentTaskId: 'ops_close_01',
  dependsOnTaskIds: [],
  sessionType: 'CLOSE',
  triggerTime: null,
  slaDeadline: null,
  slaWindowStart: null,
  slaWindowEnd: null,
  slaType: 'FIXED_TIME',
  exceptionCode: '',
  frequencyMinutes: null,
  recurrenceGroupId: '',
  functionUrl: '',
  urdReference: '',
  fileLocation: '',
  timetable: '',
  deadline: null,
};

const NEW_TASKS = [
  {
    ...TASK_DEFAULTS,
    taskId: 'ops_close_01_s4_lot',
    taskName: 'Bot tự động tính toán thống kê số lốt giao dịch cuối ngày',
    actionDescription: 'Bot tự động tính toán thống kê số lốt giao dịch cuối ngày',
    priority: 'HIGH',
    sortOrder: 4,
    isBotCheck: true,
    botCheckType: 'RUN_LOT_MACRO',
  },
  {
    ...TASK_DEFAULTS,
    taskId: 'ops_close_01_s4_value',
    taskName: 'Bot tự động tính toán thống kê giá trị giao dịch cuối ngày',
    actionDescription: 'Bot tự động tính toán thống kê giá trị giao dịch cuối ngày',
    priority: 'HIGH',
    sortOrder: 5,
    isBotCheck: true,
    botCheckType: 'RUN_VALUE_MACRO',
  },
  {
    ...TASK_DEFAULTS,
    taskId: 'ops_close_01_s4_ccp',
    taskName: 'Bot tự động chạy báo cáo CCP Pilot Bạc Thỏi cuối ngày',
    actionDescription: 'Bot tự động chạy báo cáo CCP Pilot Bạc Thỏi cuối ngày',
    priority: 'HIGH',
    sortOrder: 6,
    isBotCheck: true,
    botCheckType: 'RUN_MACRO',
  },
];

// Task ID cũ và các ID tách đã tồn tại (idempotent — chạy nhiều lần vẫn an toàn)
const REPLACED_TASK_IDS = [
  'ops_close_01_s4',
  'ops_close_01_s4_lot',
  'ops_close_01_s4_value',
  'ops_close_01_s4_ccp',
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('');
  console.log('=================================================================');
  console.log('  update-close-trading-tasks.js');
  console.log('  Split ops_close_01_s4 (RUN_MACRO) → 3 task bot riêng biệt');
  console.log('=================================================================');
  console.log(`DB   : ${DB_NAME}`);
  console.log(`TMPL : ${CLOSE_TEMPLATE_ID}`);
  console.log('');

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('[✓] Connected to MongoDB.\n');

    const db = client.db(DB_NAME);
    const col = db.collection('checklist_templates');

    // 1. Tìm template
    const template = await col.findOne({ _id: new ObjectId(CLOSE_TEMPLATE_ID) });
    if (!template) {
      throw new Error(
        `Template không tìm thấy với ID: ${CLOSE_TEMPLATE_ID}\n` +
        `  Hãy chắc chắn đã restore collection checklist_templates từ backup gốc trước.`
      );
    }
    console.log(`[✓] Template tìm thấy: "${template.title}" (${template.tasks?.length || 0} tasks hiện tại)`);

    // 2. Hiển thị tasks trước khi sửa
    console.log('\n--- Tasks TRƯỚC khi cập nhật ---');
    (template.tasks || []).forEach(t =>
      console.log(`  [sort=${t.sortOrder}] ${t.taskId.padEnd(28)} ${t.taskName}`)
    );

    // 3. Lọc bỏ tất cả task cũ sẽ bị thay (idempotent)
    let remainingTasks = (template.tasks || []).filter(
      t => !REPLACED_TASK_IDS.includes(t.taskId)
    );

    // 4. Re-sort: các task có sortOrder >= 4 (sau vị trí cắt) tăng lên 2
    //    để nhường chỗ cho 3 task mới ở vị trí 4, 5, 6
    remainingTasks = remainingTasks.map(t => {
      if (t.sortOrder >= 4) {
        return { ...t, sortOrder: t.sortOrder + 2 };
      }
      return t;
    });

    // 5. Ghép vào và sort lại
    const updatedTasks = [...remainingTasks, ...NEW_TASKS].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );

    // 6. Hiển thị tasks sau khi sửa
    console.log('\n--- Tasks SAU khi cập nhật ---');
    updatedTasks.forEach(t =>
      console.log(
        `  [sort=${t.sortOrder}] ${t.taskId.padEnd(28)} ${t.taskName}` +
        (t.botCheckType ? `  [${t.botCheckType}]` : '')
      )
    );

    // 7. Ghi vào MongoDB
    const result = await col.updateOne(
      { _id: new ObjectId(CLOSE_TEMPLATE_ID) },
      { $set: { tasks: updatedTasks, updatedAt: new Date() } }
    );

    if (result.modifiedCount === 1) {
      console.log('\n[✓] Template đã được cập nhật thành công vào MongoDB.');
    } else if (result.matchedCount === 1 && result.modifiedCount === 0) {
      console.log('\n[=] Template tìm thấy nhưng không có thay đổi (đã cập nhật trước đó).');
    } else {
      throw new Error(`Unexpected update result: matched=${result.matchedCount}, modified=${result.modifiedCount}`);
    }

  } finally {
    await client.close();
    console.log('[✓] MongoDB connection closed.\n');
    console.log('=================================================================');
    console.log('  XONG. Hãy restart backend để nhận thay đổi.');
    console.log('=================================================================\n');
  }
}

run().catch(err => {
  console.error('\n[FATAL ERROR]', err.message);
  process.exit(1);
});
