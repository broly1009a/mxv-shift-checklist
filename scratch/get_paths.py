import paramiko
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

js_script = """
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist').then(async () => {
  const db = mongoose.connection.db;
  const settings = await db.collection('system_settings').find({
    key: { $regex: 'path' }
  }).toArray();
  settings.forEach(s => console.log(s.key, '->', s.value));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/get_paths.js', 'w') as f:
    f.write(js_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/get_paths.js')
out = stdout.read()
sys.stdout.buffer.write(out)
ssh.close()
