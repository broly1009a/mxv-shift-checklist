import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

test_js = """
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shifts');
  const db = mongoose.connection.db;

  const jobs = await db.collection('bot_jobs').find({
    jobType: { $in: ['CHECK_KLGD', 'CHECK_DSGD_BEFORE_EOD'] }
  }).sort({ createdAt: -1 }).limit(20).toArray();

  console.log(`Tìm thấy ${jobs.length} jobs mới nhất:`);
  jobs.reverse().forEach((j, idx) => {
    const vnTime = new Date(j.createdAt.getTime() + 7 * 3600 * 1000);
    const timeStr = vnTime.toISOString().substring(11, 19);
    const dateStr = vnTime.toISOString().substring(0, 10);
    console.log(`Lượt #${idx + 1} | Date: ${dateStr} ${timeStr} | Status: ${j.status} | Attempts: ${j.attempts}/${j.maxAttempts} | Error: ${j.error ? j.error.substring(0, 120) : 'none'}`);
  });

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
"""

sftp = ssh.open_sftp()
with sftp.file('/opt/mxv-checklist/backend/scratch_inspect.js', 'w') as f:
    f.write(test_js)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && node scratch_inspect.js')
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print(out)
if err:
    print("STDERR:", err)

ssh.exec_command('rm -f /opt/mxv-checklist/backend/scratch_inspect.js')
ssh.close()
