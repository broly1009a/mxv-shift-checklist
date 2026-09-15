const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();

  console.log('================================================================================');
  console.log('🚀 KÍCH HOẠT JOB CHECK_KLGD VÀ THEO DÕI TIẾN TRÌNH TRỰC TIẾP');
  console.log('================================================================================');

  const today = '2026-09-15';

  // Tìm ca trực active hôm nay
  const shift = await db.collection('shift_logs').findOne({
    $or: [
      { shiftDate: today, status: { $in: ['ACTIVE', 'PENDING'] } },
      { shiftDate: '15/09/2026', status: { $in: ['ACTIVE', 'PENDING'] } },
      { status: 'ACTIVE' },
    ],
  }, { sort: { createdAt: -1 } });

  let targetTaskId = 'TASK_CHECK_KLGD';
  if (shift && Array.isArray(shift.details)) {
    const task = shift.details.find(d =>
      d.botCheckType === 'CHECK_KLGD' ||
      d.taskId?.includes('KLGD') ||
      d.name?.toLowerCase().includes('khớp lệnh')
    );
    if (task) {
      targetTaskId = task.taskId;
      console.log(` Tìm thấy ca trực: ${shift.name || shift.shiftDate} (ID: ${shift._id}), Task ID: ${targetTaskId}`);
    }
  }

  // Kiểm tra xem có job PROCESSING nào đang chạy không
  const activeJob = await db.collection('bot_jobs').findOne({
    status: 'PROCESSING'
  });
  if (activeJob) {
    console.log(`⚠️ Đang có Job chạy dở: ${activeJob.jobType} (ID: ${activeJob._id}). Đang chờ job này kết thúc...`);
  }

  const newJob = {
    jobType: 'CHECK_KLGD',
    status: 'PENDING',
    payload: {
      taskId: targetTaskId,
      shiftLogId: shift ? shift._id.toString() : null,
      sessionDay: today,
      options: {
        checkKlgd: true,
        checkTtm: true,
        checkTttt: true,
      },
    },
    attempts: 0,
    maxAttempts: 3,
    logs: [
      `[${new Date().toISOString()}] Job enqueued via automated evaluation request.`,
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const insertRes = await db.collection('bot_jobs').insertOne(newJob);
  const jobId = insertRes.insertedId;
  console.log(`🎯 Đã tạo Job CHECK_KLGD thành công với ID: ${jobId}`);
  console.log('📡 Đang lắng nghe luồng log từ Worker trên máy chủ Ubuntu VM (10.0.0.26)...');
  console.log('--------------------------------------------------------------------------------');

  let printedLines = 0;
  const startTime = Date.now();
  const MAX_POLL_MS = 300000; // 5 phút

  while (Date.now() - startTime < MAX_POLL_MS) {
    await new Promise(r => setTimeout(r, 1500));

    const job = await db.collection('bot_jobs').findOne({ _id: jobId });
    if (!job) {
      console.log('❌ Không tìm thấy job trong DB!');
      break;
    }

    if (Array.isArray(job.logs) && job.logs.length > printedLines) {
      for (let i = printedLines; i < job.logs.length; i++) {
        console.log(job.logs[i]);
      }
      printedLines = job.logs.length;
    }

    if (job.status === 'COMPLETED' || job.status === 'ABORTED' || job.status === 'FAILED') {
      console.log('--------------------------------------------------------------------------------');
      console.log(` JOB KẾT THÚC VỚI TRẠNG THÁI: [${job.status}] (Số lần thử: ${job.attempts}/${job.maxAttempts})`);
      console.log(`⏱️ Tổng thời gian thực thi: ${((Date.now() - startTime) / 1000).toFixed(1)} giây`);

      if (job.status === 'COMPLETED') {
        const res = job.payload?.result;
        console.log('\n📊 KẾT QUẢ ĐỐI CHIẾU CHI TIẾT:');
        if (res) {
          console.log(`- M-System KLGD: ${res.msKlgd ?? 'N/A'}`);
          console.log(`- CQG KLGD: ${res.cqgKlgd ?? 'N/A'}`);
          console.log(`- Straits Nano KLGD: ${res.acmKlgd ?? 'N/A'}`);
          console.log(`- CoreCCP KLGD: ${res.ccpKlgd ?? 'N/A'}`);
          console.log(`- Chênh lệch tự doanh (evaluatedDifferACM): ${res.evaluatedDifferACM ?? 'N/A'}`);
          console.log(`- Số lệnh lệch phân loại: ${(res.discrepancies || []).length} lệnh`);
          console.log(`- Số lệnh bảo lưu chu kỳ sau (pendingSyncTrades): ${(res.pendingSyncTrades || []).length} lệnh`);
        } else {
          console.log('Payload result:', JSON.stringify(job.payload, null, 2));
        }
      } else {
        console.log(`⚠️ Lỗi chi tiết: ${job.error || 'N/A'}`);
      }
      break;
    }
  }

  await client.close();
  console.log('================================================================================');
}

main().catch(err => {
  console.error('Lỗi thực thi:', err);
  process.exit(1);
});
