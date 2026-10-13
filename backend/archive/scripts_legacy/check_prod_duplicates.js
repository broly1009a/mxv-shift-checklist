const { MongoClient, ObjectId } = require('mongodb');

async function run() {
  const url = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';
  console.log('Connecting to database:', url.replace(/:([^:@]+)@/, ':***@'));
  
  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db();

    console.log('\n=== KIỂM TRA DUPLICATE LOGS TRÊN UBUNTU DATABASE ===');

    // 1. Find Admin users
    const admins = await db.collection('users').find({ role: 'ADMIN' }).toArray();
    console.log('\n[1] Danh sách tài khoản Admin trong hệ thống:');
    admins.forEach(u => {
      console.log(`- ID: ${u._id} | Username: ${u.username} | Tên: ${u.fullName} | Email: ${u.email || 'N/A'}`);
    });

    const adminEmails = admins.map(u => u.email).filter(Boolean);
    // Add default admin emails if not explicitly set in user document
    if (!adminEmails.includes('hieptruong@mxv.vn')) adminEmails.push('hieptruong@mxv.vn');
    if (!adminEmails.includes('it.support@mxv.vn')) adminEmails.push('it.support@mxv.vn');

    // 2. Check duplicates in notification_logs
    console.log('\n[2] Kiểm tra trùng lặp trong notification_logs (thông báo đã gửi)...');
    const notifLogs = await db.collection('notification_logs')
      .find({
        recipient: { $in: adminEmails }
      })
      .sort({ createdAt: 1 })
      .toArray();

    console.log(`- Tìm thấy tổng cộng ${notifLogs.length} logs thông báo gửi tới Admin.`);
    
    let notifDuplicates = [];
    for (let i = 0; i < notifLogs.length - 1; i++) {
      const cur = notifLogs[i];
      const next = notifLogs[i + 1];

      const isSameMeta = 
        cur.eventType === next.eventType &&
        cur.recipient === next.recipient &&
        cur.channelType === next.channelType;

      if (isSameMeta) {
        const timeDiffMs = Math.abs(new Date(cur.createdAt) - new Date(next.createdAt));
        if (timeDiffMs <= 10 * 60 * 1000) { // 10 minutes threshold
          notifDuplicates.push({
            eventType: cur.eventType,
            recipient: cur.recipient,
            channel: cur.channelType,
            log1: { id: cur._id, createdAt: cur.createdAt, status: cur.status },
            log2: { id: next._id, createdAt: next.createdAt, status: next.status },
            timeDiffMinutes: (timeDiffMs / (60 * 1000)).toFixed(1)
          });
          i++; // Skip next to avoid triple counting
        }
      }
    }
    console.log(`- Số lượng thông báo bị trùng lặp gửi tới Admin (trong 10 phút): ${notifDuplicates.length}`);
    if (notifDuplicates.length > 0) {
      console.log('Chi tiết trùng lặp thông báo gửi tới Admin:');
      console.log(JSON.stringify(notifDuplicates, null, 2));
    }

    // 3. Check duplicates in system_logs
    console.log('\n[3] Kiểm tra trùng lặp trong system_logs của Admin...');
    const adminIds = admins.map(u => u._id);
    const systemLogs = await db.collection('system_logs')
      .find({ actorUserId: { $in: adminIds } })
      .sort({ createdAt: 1 })
      .toArray();

    console.log(`- Tìm thấy ${systemLogs.length} system logs do Admin thực hiện.`);
    let sysDuplicates = [];
    for (let i = 0; i < systemLogs.length - 1; i++) {
      const cur = systemLogs[i];
      const next = systemLogs[i + 1];

      const isSameMeta = 
        cur.eventType === next.eventType &&
        cur.status === next.status &&
        cur.message === next.message;

      if (isSameMeta) {
        const timeDiffMs = Math.abs(new Date(cur.createdAt) - new Date(next.createdAt));
        if (timeDiffMs <= 5000) { // 5 seconds threshold
          sysDuplicates.push({
            eventType: cur.eventType,
            message: cur.message,
            log1: { id: cur._id, createdAt: cur.createdAt },
            log2: { id: next._id, createdAt: next.createdAt },
            timeDiffSeconds: timeDiffMs / 1000
          });
          i++;
        }
      }
    }
    console.log(`- Số lượng log hệ thống bị trùng lặp (trong 5 giây): ${sysDuplicates.length}`);
    if (sysDuplicates.length > 0) {
      console.log('Chi tiết trùng lặp logs hệ thống:');
      console.log(JSON.stringify(sysDuplicates.slice(0, 10), null, 2));
    }

    // 4. Check duplicates in audit_logs
    console.log('\n[4] Kiểm tra trùng lặp trong audit_logs (Thao tác tích/hủy ca trực)...');
    const auditLogs = await db.collection('audit_logs')
      .find({ userId: { $in: adminIds } })
      .sort({ createdAt: 1 })
      .toArray();

    console.log(`- Tìm thấy ${auditLogs.length} audit logs của Admin.`);
    let auditDuplicates = [];
    for (let i = 0; i < auditLogs.length - 1; i++) {
      const cur = auditLogs[i];
      const next = auditLogs[i + 1];

      const isSameMeta = 
        cur.shiftLogId.toString() === next.shiftLogId.toString() &&
        cur.taskId === next.taskId &&
        cur.action === next.action;

      if (isSameMeta) {
        const timeDiffMs = Math.abs(new Date(cur.createdAt) - new Date(next.createdAt));
        if (timeDiffMs <= 5000) { // 5 seconds threshold
          auditDuplicates.push({
            action: cur.action,
            taskId: cur.taskId,
            taskName: cur.taskName,
            details: cur.details,
            log1: { id: cur._id, createdAt: cur.createdAt },
            log2: { id: next._id, createdAt: next.createdAt },
            timeDiffSeconds: timeDiffMs / 1000
          });
          i++;
        }
      }
    }
    console.log(`- Số lượng audit logs bị trùng lặp: ${auditDuplicates.length}`);
    if (auditDuplicates.length > 0) {
      console.log('Chi tiết trùng lặp audit logs:');
      console.log(JSON.stringify(auditDuplicates.slice(0, 10), null, 2));
    }

  } catch (err) {
    console.error('Lỗi khi truy vấn:', err.message);
  } finally {
    await client.close();
  }
}

run();
