import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

test_js = """
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv-shift-checklist');
  let job = await mongoose.connection.collection('bot_jobs').findOne({ _id: '6ad590adc765f06c8bbf8248' });
  if (!job) {
    try {
      job = await mongoose.connection.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ad590adc765f06c8bbf8248') });
    } catch {}
  }
  if (!job) {
    console.log('Searching latest jobs for 2026-10-19:');
    const list = await mongoose.connection.collection('bot_jobs').find({ jobType: 'CHECK_KLGD' }).sort({ createdAt: -1 }).limit(3).toArray();
    for (const j of list) {
      console.log('--- JOB:', j._id, 'status:', j.status, 'attempts:', j.attempts, '/', j.maxAttempts, 'createdAt:', j.createdAt);
      console.log('Error:', j.error);
      console.log('Logs:');
      (j.logs || []).slice(-6).forEach(l => console.log('  ', l));
    }
    return;
  }
  console.log('Job found:', job._id, 'status:', job.status, 'attempts:', job.attempts, '/', job.maxAttempts);
  console.log('Error:', job.error);
  (job.logs || []).forEach(l => console.log('  ', l));
}
run().then(() => process.exit(0)).catch(console.error);
"""

sftp = ssh.open_sftp()
with sftp.file('/opt/mxv-checklist/backend/inspect_specific_job.js', 'w') as f:
    f.write(test_js)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && node inspect_specific_job.js')
out = stdout.read().decode('utf-8', errors='ignore')
print(out)

ssh.close()
