import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

test_script = """
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
const { decrypt } = require('/opt/mxv-checklist/backend/dist/shared/helpers/crypto');

mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist').then(async () => {
  const db = mongoose.connection.db;
  const s = await db.collection('system_settings').findOne({ key: 'bot_credentials_msystem' });
  console.log('bot_credentials_msystem raw:', s ? s.value : 'NOT_FOUND');
  if (s) {
    try {
      const dec = decrypt(s.value);
      console.log('Decrypted:', dec);
    } catch (e) {
      console.log('Decrypt error:', e.message);
    }
  }
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/check_ms_cred.js', 'w') as f:
    f.write(test_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/check_ms_cred.js')
out = stdout.read().decode('utf-8', errors='ignore')
print(out.encode('ascii', errors='replace').decode('ascii'))
ssh.close()
