import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

script = """
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
const fs = require('fs');
const dotenv = require('/opt/mxv-checklist/backend/node_modules/dotenv');
const env = dotenv.parse(fs.readFileSync('/opt/mxv-checklist/backend/.env'));

(async () => {
  await mongoose.connect(env.MONGODB_URI);
  const db = mongoose.connection.db;
  const all = await db.collection('system_settings').find({}).toArray();
  const filtered = all.filter(c => /rate|ty_gia|tygia|usd/i.test(c.key));
  console.log('Exchange rate settings in DB:', filtered);
  await mongoose.disconnect();
})();
"""

stdin, stdout, stderr = ssh.exec_command(f'node -e "{script}"')
print(stdout.read().decode('utf-8', errors='ignore'))
err = stderr.read().decode('utf-8', errors='ignore')
if err:
    print("ERR:", err)
ssh.close()
