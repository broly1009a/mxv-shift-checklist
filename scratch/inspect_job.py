import paramiko
import json

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

js_script = """
const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist').then(async () => {
  const job = await mongoose.connection.db.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ad22da198f8079c51339bab') });
  console.log(JSON.stringify(job, null, 2));
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/inspect_job.js', 'w') as f:
    f.write(js_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/inspect_job.js')
import sys
sys.stdout.buffer.write(stdout.read())
sys.stderr.buffer.write(stderr.read())
ssh.close()
