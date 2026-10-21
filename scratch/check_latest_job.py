import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26')

remote_code = '''
const { MongoClient } = require('/opt/mxv-checklist/backend/node_modules/mongodb');

async function main() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const l = await db.collection('trading_recon_logs').findOne({ _id: new (require('mongodb').ObjectId)('6ad876c609596897352dc632') });
  console.log("Keys in log 6ad876c609596897352dc632:", Object.keys(l));
  console.log("Full Log:", JSON.stringify(l, null, 2));
  await client.close();
}

main().catch(console.error);
'''

sftp = ssh.open_sftp()
with sftp.file('/tmp/check_one_log.js', 'w') as f:
    f.write(remote_code)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('node /tmp/check_one_log.js')
print(stdout.read().decode('utf-8'))
ssh.close()
