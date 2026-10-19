import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

test_script = """
require('/opt/mxv-checklist/backend/node_modules/dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const job = await db.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ad2309d61ae4edad944b3cd') });
  if (job) {
    console.log('JOB LOGS for 6ad2309d61ae4edad944b3cd:');
    job.logs.forEach(l => console.log(l));
  } else {
    console.log('Job not found');
  }
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/inspect_job_logs.js', 'w') as f:
    f.write(test_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/inspect_job_logs.js')
out = stdout.read().decode('utf-8', errors='ignore')
print(out.encode('ascii', errors='replace').decode('ascii'))
ssh.close()
