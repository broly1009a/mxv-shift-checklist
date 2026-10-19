import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

js_code = """
const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist').then(async () => {
  const db = mongoose.connection.db;
  const jobs = await db.collection('bot_jobs').find({
    createdAt: { $gte: new Date('2026-10-16T10:00:00Z'), $lte: new Date('2026-10-16T16:00:00Z') }
  }).sort({ createdAt: 1 }).toArray();
  console.log('Jobs count:', jobs.length);
  for (const j of jobs) {
    console.log('JOB:', j._id.toString(), j.jobType, j.status, j.createdAt);
    if (j.error) console.log('  Error:', j.error);
    if (j.logs) {
      const msLogs = j.logs.filter(l => l.includes('MS'));
      console.log('  MS logs:', msLogs.slice(-2));
    }
  }
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/check_jobs_tmp.js', 'w') as f:
    f.write(js_code)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/check_jobs_tmp.js')
out = stdout.read().decode('utf-8', errors='ignore')
print(out.encode('ascii', errors='replace').decode('ascii'))
ssh.close()
