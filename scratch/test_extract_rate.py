import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

script = """
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');
const fs = require('fs');

const ttttPath = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/20.10/TTTT.xlsx';
const tygiaPath = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/20.10/Tỷ giá CCP.xlsx';

console.log('--- Test TTTT ---');
if (fs.existsSync(ttttPath)) {
  const wb = XLSX.readFile(ttttPath);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  console.log('TTTT headers:', rows[0]);
  console.log('TTTT row 1:', rows[1]);
}

console.log('--- Test Ty Gia CCP ---');
if (fs.existsSync(tygiaPath)) {
  const wb = XLSX.readFile(tygiaPath);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  console.log('Ty gia headers:', rows[0]);
  console.log('Ty gia rows:', rows.slice(1));
}
"""

stdin, stdout, stderr = ssh.exec_command(f'node -e "{script}"')
print(stdout.read().decode('utf-8', errors='ignore'))
err = stderr.read().decode('utf-8', errors='ignore')
if err:
    print("ERR:", err)
ssh.close()
