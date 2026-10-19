import paramiko
import sys

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = """cd /opt/mxv-checklist/backend && node -e '
const fs = require("fs");
const path = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026/14.10/DSQLKQ.xlsx";
const XLSX = require("xlsx");
if (fs.existsSync(path)) {
  const wb = XLSX.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log("DSQLKQ_ROW_COUNT:", rows.length);
} else {
  console.log("FILE_NOT_FOUND");
}
'"""
stdin, stdout, stderr = client.exec_command(cmd)
out = stdout.read().decode('ascii', errors='ignore')
print(out)
client.close()
