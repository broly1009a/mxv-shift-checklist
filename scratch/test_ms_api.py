import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

test_script = """
const fs = require('fs');
const path = require('path');

async function testMsApi() {
  const sessionPath = '/tmp/ms_session.json';
  // Check if session file exists or read from common locations
  let token = null;
  const candidates = [
    '/opt/mxv-checklist/backend/data/ms_session.json',
    '/tmp/ms_session.json',
    '/opt/mxv-checklist/backend/.ms_session.json'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        const d = JSON.parse(fs.readFileSync(c, 'utf8'));
        if (d.token) { token = d.token; console.log('Found token in', c); break; }
      } catch {}
    }
  }

  // If no token cached, let's run a test via nestjs or curl
  console.log('Token found:', !!token);
}

testMsApi();
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/test_ms_api_tmp.js', 'w') as f:
    f.write(test_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/test_ms_api_tmp.js')
out = stdout.read().decode('utf-8', errors='ignore')
print(out.encode('ascii', errors='replace').decode('ascii'))
ssh.close()
