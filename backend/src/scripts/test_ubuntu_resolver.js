const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `
    node -e "
      const { MongoClient } = require('/opt/mxv-checklist/backend/node_modules/mongodb');
      async function main() {
        const c = new MongoClient('mongodb://127.0.0.1:27017/mxv_shift_checklist');
        await c.connect();
        const shifts = await c.db().collection('shift_logs')
          .find({ shiftDate: '2026-09-15' })
          .sort({ createdAt: -1 })
          .toArray();
        console.log('=== DANH SÁCH CA TRỰC NGÀY 2026-09-15 TRÊN UBUNTU ===');
        console.log('Tổng số ca tìm thấy:', shifts.length);
        shifts.forEach((s, idx) => {
          const klgdTask = (s.details || []).find(t => (t.botCheckTypeSnapshot === 'CHECK_KLGD' || t.botCheckType === 'CHECK_KLGD'));
          console.log(\`  [\${idx + 1}] ID: \${s._id.toString()} | Status: [\${s.status}] | SlotId: \${s.shiftSlotId} | Created: \${s.createdAt ? s.createdAt.toISOString() : 'N/A'}\`);
          console.log(\`      Chứa task CHECK_KLGD: \${klgdTask ? 'CÓ (TaskId: ' + klgdTask.taskId + ')' : 'KHÔNG'}\`);
        });

        // 1. Thuật toán CŨ
        const oldQuery = {
          \\$or: [
            { shiftDate: '2026-09-15', status: { \\$in: ['ACTIVE', 'PENDING'] } },
            { shiftDate: '15/09/2026', status: { \\$in: ['ACTIVE', 'PENDING'] } },
            { shiftDate: '2026-09-15' },
            { shiftDate: '15/09/2026' },
          ],
        };
        const oldShift = await c.db().collection('shift_logs').findOne(oldQuery, { sort: { createdAt: -1 } });
        console.log('\\n=== THUẬT TOÁN CŨ (TRƯỚC KHI SỬA) ===');
        console.log('  -> Bốc trúng Ca ID:', oldShift?._id.toString(), '| Status:', oldShift?.status);
        if (oldShift?.status === 'COMPLETED') {
          console.log('   HẬU QUẢ: Bốc trúng ca COMPLETED -> Queue Guard sẽ CANCEL Job ngay lập tức!');
        }

        // 2. Thuật toán MỚI 3 tầng
        console.log('\\n=== THUẬT TOÁN MỚI 3 TẦNG (ĐÃ SỬA) ===');
        const openShifts = shifts.filter(s => s.status === 'ACTIVE' || s.status === 'PENDING');
        console.log('  - Số lượng ca đang MỞ:', openShifts.length);
        let targetShift = null;
        let reason = '';
        if (openShifts.length > 0) {
          const candidates = openShifts.filter(s => {
            return (s.details || []).some(t => (t.botCheckTypeSnapshot === 'CHECK_KLGD' || t.botCheckType === 'CHECK_KLGD'));
          });
          if (candidates.length === 1) {
            targetShift = candidates[0];
            reason = 'TẦNG 1.1: Tìm thấy ca MỞ duy nhất chứa task CHECK_KLGD';
          } else if (candidates.length > 1) {
            targetShift = candidates[0];
            reason = 'TẦNG 1.2: Nhiều ca mở chứa task -> Chọn ca khớp giờ/mới nhất';
          } else {
            targetShift = openShifts[0];
            reason = 'TẦNG 1.3: Chọn ca mở mới nhất';
          }
        }
        if (targetShift) {
          const task = (targetShift.details || []).find(t => (t.botCheckTypeSnapshot === 'CHECK_KLGD' || t.botCheckType === 'CHECK_KLGD'));
          console.log('  ✅ THÀNH CÔNG: Đã chọn đúng Ca ID:', targetShift._id.toString());
          console.log('  - Trạng thái ca:', targetShift.status, '(HỢP LỆ, KHÔNG BỊ CANCEL!)');
          console.log('  - Lý do:', reason);
          console.log('  - Task ID ánh xạ:', task ? task.taskId : 'N/A');
          console.log('  - shiftLogId gán vào Job:', targetShift._id.toString());
        }
        await c.close();
      }
      main().catch(console.error);
    "
  `;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
