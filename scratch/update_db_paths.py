import paramiko
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

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
  
  await db.collection('system_settings').updateOne(
    { key: 'recon_folder_check_path' },
    { $set: { value: 'M:\\\\Tailieuchung\\\\QLGD-IT\\\\Quanlygiaodich\\\\Tai lieu hoat dong\\\\TradingCheck\\\\Futures', updatedAt: new Date() } },
    { upsert: true }
  );

  await db.collection('system_settings').updateOne(
    { key: 'recon_result_folder_path' },
    { $set: { value: 'M:\\\\Tailieuchung\\\\QLGD-IT\\\\Quanlygiaodich\\\\Tai lieu hoat dong\\\\TradingCheck\\\\Ket qua check KLGD', updatedAt: new Date() } },
    { upsert: true }
  );

  await db.collection('system_settings').updateOne(
    { key: 'gtt_import_path' },
    { $set: { value: 'M:\\\\Tailieuchung\\\\QLGD-IT\\\\Quanlygiaodich\\\\Tai lieu hoat dong\\\\TradingCheck\\\\GTT', updatedAt: new Date() } },
    { upsert: true }
  );

  console.log('--- UPDATED SYSTEM SETTINGS ---');
  const res = await db.collection('system_settings').find({
    key: { $in: ['recon_folder_check_path', 'recon_result_folder_path', 'gtt_import_path'] }
  }).toArray();
  res.forEach(r => console.log(r.key, '=', r.value));

  await mongoose.disconnect();
})();
"""

import base64
b64 = base64.b64encode(script.encode('utf-8')).decode('utf-8')
stdin, stdout, stderr = ssh.exec_command(f'node -e "eval(Buffer.from(\'{b64}\', \'base64\').toString(\'utf-8\'))"')
print(stdout.read().decode('utf-8', errors='ignore'))
err = stderr.read().decode('utf-8', errors='ignore')
if err:
    print('ERR:', err)
ssh.close()
