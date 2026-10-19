import paramiko
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

js_script = """
const fs = require('fs');
const path = require('path');
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

// Find all Fill.xlsx or Straits files on server for today 19.10
const possibleDirs = [
  '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/ACM/2026/T10.2026/19.10',
  '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/19.10',
  '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/ACM/2026/T10.2026/19.10',
  '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/2026/T10.2026/19.10'
];

possibleDirs.forEach(d => {
  console.log('Checking dir:', d);
  if (fs.existsSync(d)) {
    fs.readdirSync(d).forEach(f => {
      const st = fs.statSync(path.join(d, f));
      console.log(' ', f, st.size, 'bytes, mtime:', st.mtime.toISOString());
    });
  } else {
    console.log(' (Dir does not exist)');
  }
});
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/inspect_acm_files.js', 'w') as f:
    f.write(js_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/inspect_acm_files.js')
out = stdout.read()
sys.stdout.buffer.write(out)
ssh.close()
