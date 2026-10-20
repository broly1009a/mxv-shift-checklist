import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

script = """
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');
const fs = require('fs');

const p = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/20.10/Tỷ giá CCP.xlsx';
if (fs.existsSync(p)) {
  const wb = XLSX.readFile(p);
  console.log('Sheets in Ty gia CCP:', wb.SheetNames);
  const s = wb.Sheets[wb.SheetNames[0]];
  console.log('Data:', JSON.stringify(XLSX.utils.sheet_to_json(s), null, 2));
} else {
  console.log('File not found:', p);
}
"""

stdin, stdout, stderr = ssh.exec_command(f'node -e "{script}"')
print(stdout.read().decode('utf-8', errors='ignore'))
err = stderr.read().decode('utf-8', errors='ignore')
if err:
    print("ERR:", err)
ssh.close()
