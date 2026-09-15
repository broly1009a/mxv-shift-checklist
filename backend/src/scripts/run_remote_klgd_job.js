const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const localScriptPath = path.join(__dirname, 'exec_klgd_on_server.js');
const remoteScriptPath = '/opt/mxv-checklist/backend/exec_klgd_on_server.js';

// Tạo script thực thi trực tiếp trên máy chủ Ubuntu
const serverScriptContent = `
require('dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { BotJobQueueService } = require('./dist/modules/bot-engine/bot-job-queue.service');
const { getModelToken } = require('@nestjs/mongoose');

async function run() {
  console.log('================================================================================');
  console.log('🚀 KHỞI ĐỘNG KIỂM THỬ THỰC TẾ: JOB CHECK_KLGD VỚI BỘ LẮNG NGHE PHIÊN CQG MỚI');
  console.log('================================================================================');
  console.log('[1/4] Đang khởi tạo NestJS Application Context trên máy chủ Ubuntu Linux...');
  
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const botJobModel = app.get(getModelToken('BotJob'));
  const jobQueueService = app.get(BotJobQueueService);

  const today = '2026-09-15';
  console.log('[2/4] Đang tạo bản ghi Job CHECK_KLGD cho ngày:', today);

  const job = new botJobModel({
    jobType: 'CHECK_KLGD',
    status: 'PROCESSING',
    attempts: 1,
    maxAttempts: 3,
    payload: {
      sessionDay: today,
      options: {
        checkKlgd: true,
        checkTtm: true,
        checkTttt: true,
      },
    },
    logs: [
      \`[\${new Date().toISOString()}] Job enqueued via Live User Request.\`,
      \`[\${new Date().toISOString()}] Starting attempt 1/3 (Live Test with CQG Takeover Listener)...\`,
    ],
  });
  await job.save();
  console.log(\` Đã tạo Job ID: \${job._id}\`);
  console.log('[3/4] Bắt đầu thực thi trực tiếp qua BotJobQueueService & ReconJobsHandler...');
  console.log('--------------------------------------------------------------------------------');

  const startTime = Date.now();

  try {
    await jobQueueService.executeJobDirectly(job);
    job.status = 'COMPLETED';
    job.completedAt = new Date();
    job.logs.push(\`[\${new Date().toISOString()}] Job hoàn thành thành công 100%.\`);
    await job.save();

    console.log('--------------------------------------------------------------------------------');
    console.log(' [THÀNH CÔNG] JOB CHECK_KLGD ĐÃ HOÀN TẤT THÀNH CÔNG VỚI TRẠNG THÁI COMPLETED!');
    console.log(\`⏱️ Thời gian thực thi: \${((Date.now() - startTime) / 1000).toFixed(1)} giây\`);
    
    // In payload kết quả
    const res = job.payload?.result || job.payload?.get?.('result');
    if (res) {
      console.log('\\n📊 KẾT QUẢ ĐỐI SOÁT CHI TIẾT:');
      console.log(\`- M-System KLGD: \${res.msKlgd ?? 'N/A'} lot\`);
      console.log(\`- CQG KLGD: \${res.cqgKlgd ?? 'N/A'} lot\`);
      console.log(\`- Straits ACM KLGD: \${res.acmKlgd ?? 'N/A'} lot\`);
      console.log(\`- CoreCCP KLGD: \${res.ccpKlgd ?? 'N/A'} lot\`);
      console.log(\`- Lệch tự doanh Nano (evaluatedDifferACM): \${res.evaluatedDifferACM ?? 0} lot\`);
      console.log(\`- Số lệnh lệch: \${(res.discrepancies || []).length} lệnh\`);
      console.log(\`- Số lệnh bảo lưu (pendingSyncTrades): \${(res.pendingSyncTrades || []).length} lệnh\`);
    }

    console.log('\\n📜 TOÀN BỘ NHẬT KÝ THỰC THI (LOGS):');
    job.logs.forEach(l => console.log(l));

  } catch (err) {
    console.error('\\n❌ [LỖI THỰC THI]:', err.message);
    job.status = 'FAILED';
    job.failedAt = new Date();
    job.error = err.message;
    job.logs.push(\`[\${new Date().toISOString()}] Lỗi thực thi: \${err.message}\`);
    await job.save();

    console.log('\\n📜 NHẬT KÝ THỰC THI ĐẾN THỜI ĐIỂM LỖI:');
    job.logs.forEach(l => console.log(l));
  } finally {
    await app.close();
    console.log('================================================================================');
    process.exit(0);
  }
}

run().catch(e => {
  console.error('Fatal crash:', e);
  process.exit(1);
});
`;

fs.writeFileSync(localScriptPath, serverScriptContent, 'utf8');

const conn = new Client();
console.log('Đang kết nối SSH tới Ubuntu Server 10.0.0.26...');

conn.on('ready', () => {
  console.log(' Đã kết nối SSH. Đang tải script test lên máy chủ qua SFTP...');
  conn.sftp((err, sftp) => {
    if (err) {
      console.error('Lỗi SFTP:', err);
      conn.end();
      return;
    }

    const readStream = fs.createReadStream(localScriptPath);
    const writeStream = sftp.createWriteStream(remoteScriptPath);

    writeStream.on('close', () => {
      console.log(' Đã upload script lên server. Bắt đầu chạy Job CHECK_KLGD trực tiếp...');
      console.log('--------------------------------------------------------------------------------');

      const cmd = `cd /opt/mxv-checklist/backend && node exec_klgd_on_server.js`;
      conn.exec(cmd, (execErr, stream) => {
        if (execErr) {
          console.error('Lỗi exec:', execErr);
          conn.end();
          return;
        }

        stream.on('data', (d) => {
          process.stdout.write(d.toString());
        });

        stream.stderr.on('data', (d) => {
          process.stderr.write(d.toString());
        });

        stream.on('close', (code) => {
          console.log('\n--------------------------------------------------------------------------------');
          console.log(`Tiến trình kết thúc với mã: ${code}`);
          // Dọn dẹp script trên server
          conn.exec(`rm -f ${remoteScriptPath}`, () => {
            conn.end();
          });
        });
      });
    });

    readStream.pipe(writeStream);
  });
}).on('error', (err) => {
  console.error('SSH Error:', err);
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 30000,
});
