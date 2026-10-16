const { Client } = require('ssh2');

async function main() {
  console.log('Connecting to Ubuntu 10.0.0.26 to extract recent CHECK_KLGD and CQG download logs...\n');

  const conn = new Client();

  conn.on('ready', () => {
    console.log('Connected via SSH. Running remote inspection command...\n');

    const remoteCmd = `python3 -c "
import json
import re

# 1. Quét PM2 out log tìm các mốc thời gian tải CQG và CHECK_KLGD trong 48h qua
cqg_lines = []
try:
    with open('/home/mxvadmin/.pm2/logs/mxv-backend-out.log', 'r', errors='ignore') as f:
        for line in f:
            lower = line.lower()
            if any(k in lower for k in ['cqg', 'check_klgd', 'fr1', 'fr2', 'fr.xlsx', 'automerge', 'barrier']):
                cqg_lines.append(line.rstrip())
except Exception as e:
    cqg_lines.append('Lỗi đọc PM2 log: ' + str(e))

print('===PM2_CQG_LOGS_START===')
print('\\n'.join(cqg_lines[-200:])) # 200 dòng mới nhất
print('===PM2_CQG_LOGS_END===')

# 2. Đọc file overnight log nếu có
try:
    with open('/opt/mxv-checklist/backend/check_klgd_overnight_log.txt', 'r', errors='ignore') as f:
        overnight = f.read()
        print('===OVERNIGHT_LOG_START===')
        print(overnight[-4000:])
        print('===OVERNIGHT_LOG_END===')
except Exception as e:
    print('===OVERNIGHT_LOG_START===')
    print('Không tìm thấy check_klgd_overnight_log.txt: ' + str(e))
    print('===OVERNIGHT_LOG_END===')
" && node -e '
const mongoose = require("/opt/mxv-checklist/backend/node_modules/mongoose");

async function checkJobs() {
  await mongoose.connect("mongodb://127.0.0.1:27017/mxv_shift_checklist");
  const db = mongoose.connection.db;

  // Lấy 10 jobs CHECK_KLGD mới nhất
  const jobs = await db.collection("bot_jobs").find({
    jobType: "CHECK_KLGD"
  }).sort({ createdAt: -1 }).limit(10).toArray();

  const formatted = jobs.map(j => ({
    id: j._id,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
    status: j.status,
    durationMs: j.durationMs,
    summary: j.summary,
    cqgLogs: (j.logs || []).filter(l => /cqg|fr|tải/i.test(l)),
    allLogs: j.logs || []
  }));

  console.log("===JOBS_DATA_START===");
  console.log(JSON.stringify(formatted, null, 2));
  console.log("===JOBS_DATA_END===");

  await mongoose.disconnect();
}
checkJobs().catch(e => console.error("MongoDB Error:", e.message));
'`;

    let stdout = '';
    conn.exec(remoteCmd, { maxBuffer: 50 * 1024 * 1024 }, (err, stream) => {
      if (err) {
        console.error('SSH Exec Error:', err);
        conn.end();
        return;
      }

      stream.on('data', (d) => {
        stdout += d.toString();
      });

      stream.stderr.on('data', (d) => {
        console.error('STDERR:', d.toString());
      });

      stream.on('close', (code) => {
        conn.end();
        console.log(`SSH Execution finished with code ${code}.\n`);
        analyzeLogs(stdout);
      });
    });
  }).connect({
    host: '10.0.0.26',
    port: 22,
    username: 'mxvadmin',
    password: 'MxV!,#2o26',
    readyTimeout: 15000,
  });
}

function analyzeLogs(raw) {
  const pm2Match = raw.match(/===PM2_CQG_LOGS_START===([\s\S]*?)===PM2_CQG_LOGS_END===/);
  const overnightMatch = raw.match(/===OVERNIGHT_LOG_START===([\s\S]*?)===OVERNIGHT_LOG_END===/);
  const jobsMatch = raw.match(/===JOBS_DATA_START===([\s\S]*?)===JOBS_DATA_END===/);

  console.log('================================================================================');
  console.log('                PHÂN TÍCH LOG CHECK_KLGD & TẢI CQG TRÊN UBUNTU                ');
  console.log('================================================================================\n');

  if (jobsMatch) {
    try {
      const jobs = JSON.parse(jobsMatch[1]);
      console.log(`[MongoDB] Tìm thấy ${jobs.length} jobs CHECK_KLGD gần nhất:\n`);

      jobs.forEach((job, idx) => {
        console.log(`--------------------------------------------------------------------------------`);
        console.log(`Job #${idx + 1}: ${job.id} | Status: ${job.status} | CreatedAt: ${job.createdAt}`);
        console.log(`Summary: ${job.summary || 'N/A'}`);
        if (job.durationMs) {
          console.log(`Total Duration: ${job.durationMs} ms (~${(job.durationMs / 1000).toFixed(1)}s)`);
        }
        console.log('\n--- Các log liên quan đến CQG & Tải dữ liệu ---');
        if (job.cqgLogs && job.cqgLogs.length > 0) {
          job.cqgLogs.forEach(l => console.log(`  > ${l}`));
        } else {
          console.log('  (Không có log CQG riêng lẻ)');
        }

        // Trích xuất timing bắt đầu vs kết thúc tải CQG
        const cqgStartLog = (job.allLogs || []).find(l => l.includes('Mở đồng thời 2 tài khoản CQG1 & CQG2') || l.includes('CQG  [Bước 1: Chuẩn bị]'));
        const cqgEndLog = (job.allLogs || []).find(l => l.includes('Ghép file CQG hoàn tất') || l.includes('Đã hoàn tất và đóng trình duyệt CQG'));
        if (cqgStartLog && cqgEndLog) {
          console.log(`\n  Timing trích xuất:`);
          console.log(`  - Bắt đầu CQG: ${cqgStartLog}`);
          console.log(`  - Kết thúc CQG: ${cqgEndLog}`);
        }
        console.log('');
      });
    } catch (e) {
      console.log('Error parsing jobs data:', e.message);
    }
  }

  if (overnightMatch && overnightMatch[1].trim()) {
    console.log('\n================================================================================');
    console.log('             NỘI DUNG OVERNIGHT LOG (check_klgd_overnight_log.txt)              ');
    console.log('================================================================================');
    console.log(overnightMatch[1].trim());
  }

  if (pm2Match && pm2Match[1].trim()) {
    console.log('\n================================================================================');
    console.log('                        PM2 LOGS GẦN ĐÂY LIÊN QUAN ĐẾN CQG                      ');
    console.log('================================================================================');
    const lines = pm2Match[1].trim().split('\n');
    console.log(lines.slice(-50).join('\n'));
  }
}

main().catch(console.error);
