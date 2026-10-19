import paramiko
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

js_script = """
const fs = require('fs');
const path = require('path');
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

const msDir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/19.10';
const cqgDir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026/19.10';

console.log('--- MS FILES IN TradingCheck/Futures/2026/T10.2026/19.10 ---');
fs.readdirSync(msDir).forEach(f => {
  const st = fs.statSync(path.join(msDir, f));
  console.log(f, st.size, 'bytes, mtime:', st.mtime.toISOString());
});

// Parse TTM.xlsx
const ttmPath = path.join(msDir, 'TTM.xlsx');
if (fs.existsSync(ttmPath)) {
  const wb = XLSX.readFile(ttmPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log('\\n[TTM.xlsx] Total rows:', rows.length);
  console.log('Header:', rows[0]);
  let sumBuy = 0, sumSell = 0, countA = 0, sumNonA = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const acc = String(r[1] || r[0] || '').trim();
    // find columns
    // In TTM: col 1 is Ma TKGD? or col 0?
    // Let's check rows[0]
  }
}

// Parse TTTT.xlsx
const ttttPath = path.join(msDir, 'TTTT.xlsx');
if (fs.existsSync(ttttPath)) {
  const wb = XLSX.readFile(ttttPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log('\\n[TTTT.xlsx] Total rows:', rows.length);
  console.log('Header:', rows[0]);
}
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/inspect_ms_trading_check.js', 'w') as f:
    f.write(js_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/inspect_ms_trading_check.js')
out = stdout.read()
sys.stdout.buffer.write(out)
ssh.close()
