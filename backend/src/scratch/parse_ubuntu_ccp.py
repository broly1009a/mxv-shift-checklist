import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26')

cmd = """
node -e '
const fs = require("fs");
const XLSX = require("/opt/mxv-checklist/backend/node_modules/xlsx");

function parse(p) {
  console.log("Parsing:", p);
  const wb = XLSX.readFile(p);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const header = rows[0].map(h => String(h || "").trim());
  const soTKIdx = header.findIndex(h => /tài khoản|mã tk|account|sotk/i.test(h));
  const klIdx = header.findIndex(h => /kl khớp|khối lượng|volume|qty/i.test(h));

  let totalAll = 0;
  let totalA = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const acc = String(r[soTKIdx] || "").trim();
    const kl = parseFloat(r[klIdx]) || 0;
    totalAll += kl;
    if (acc.toUpperCase().endsWith("A")) totalA += kl;
  }
  console.log("Rows:", rows.length, "Total All:", totalAll, "Total A:", totalA);
}

parse("/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/20.10/DSGD CCP.xlsx");
parse("/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/CCP/Futures/2026/T10.2026/20.10/DSGD_20.10.2026.xlsx");
'
"""
stdin, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:\n", stdout.read().decode('utf-8', errors='ignore'))
print("STDERR:\n", stderr.read().decode('utf-8', errors='ignore'))
ssh.close()
