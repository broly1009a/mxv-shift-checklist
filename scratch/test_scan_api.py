import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

# Test getting a token first, then calling scan-daily
script = """
const jwt = require('/opt/mxv-checklist/backend/node_modules/jsonwebtoken');
const fs = require('fs');
const dotenv = require('/opt/mxv-checklist/backend/node_modules/dotenv');
const env = dotenv.parse(fs.readFileSync('/opt/mxv-checklist/backend/.env'));
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');

(async () => {
  await mongoose.connect(env.MONGODB_URI);
  const u = await mongoose.connection.db.collection('users').findOne({ isActive: true });
  await mongoose.disconnect();

  const token = jwt.sign(
    {
      sub: u._id.toString(),
      username: u.username,
      role: 'SUPERADMIN',
      permissions: ['ACCESS_AUTO_SHIFT', 'ACCESS_MARGIN_CHANGE']
    },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const http = require('http');
  const configReq = http.request({
    hostname: '127.0.0.1',
    port: 3001,
    path: '/api/v1/ccp-statistics/lot-statistics/config',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  }, (cRes) => {
    let cBody = '';
    cRes.on('data', chunk => cBody += chunk);
    cRes.on('end', () => {
      console.log('Config status code:', cRes.statusCode);
      console.log('Config response length:', cBody.length);
    });
  });
  configReq.end();
})();
"""

stdin, stdout, stderr = ssh.exec_command(f'node -e "{script}"')
print(stdout.read().decode('utf-8', errors='ignore'))
err = stderr.read().decode('utf-8', errors='ignore')
if err:
    print("ERR:", err)
ssh.close()
