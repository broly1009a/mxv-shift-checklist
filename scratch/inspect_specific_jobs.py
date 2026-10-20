import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

sftp = client.open_sftp()
with sftp.file('/tmp/check_jobs.js', 'w') as f:
    f.write('''
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
const fs = require('fs');

async function run() {
  const envContent = fs.readFileSync('/opt/mxv-checklist/backend/.env', 'utf8');
  let mongoUri = 'mongodb://127.0.0.1:27017/checklist';
  for (const line of envContent.split('\\n')) {
    if (line.startsWith('MONGODB_URI=')) {
      mongoUri = line.split('=')[1].trim();
    }
  }
  const conn = await mongoose.createConnection(mongoUri).asPromise();
  const Job = conn.model('bot_jobs', new mongoose.Schema({}, { strict: false }));
  
  const ids = [
    '6ad6adc1f8ebf8525eed751a',
    '6ad6ada7f8ebf8525eed7517',
    '6ad6a78cf8ebf8525eed7512',
    '6ad6a72bf8ebf8525eed7510',
    '6ad6a6fef8ebf8525eed750e',
    '6ad6a5baf8ebf8525eed750b',
    '6ad67fd5f8ebf8525eed74e0',
  ];

  for (const id of ids) {
    const j = await Job.findById(id).lean();
    if (j) {
      console.log(j._id + ' | ' + j.jobType + ' | ' + j.triggerType + ' | ' + j.status + ' | ' + j.createdAt);
    } else {
      console.log(id + ' NOT FOUND');
    }
  }
  process.exit(0);
}
run();
''')

stdin, stdout, stderr = client.exec_command("node /tmp/check_jobs.js")
print(stdout.read().decode())
print(stderr.read().decode())
client.close()
