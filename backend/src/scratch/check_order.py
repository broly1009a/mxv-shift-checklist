import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26')

cmd = """
node -e '
const fs = require("fs");
const { parseFR } = require("/opt/mxv-checklist/backend/dist/modules/trading-ops/parsers/cqg-excel.parser");
const p1 = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026/21.10/FR1.xlsx";
const p2 = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026/21.10/FR2.xlsx";

if (fs.existsSync(p1)) {
  const fr1 = parseFR(fs.readFileSync(p1), new Date("2026-10-21T00:00:00Z"));
  const f1 = fr1.find(f => String(f.ord).includes("162091632"));
  console.log("In FR1:", f1 ? JSON.stringify(f1) : "NOT FOUND");
}

if (fs.existsSync(p2)) {
  const fr2 = parseFR(fs.readFileSync(p2), new Date("2026-10-21T00:00:00Z"));
  const f2 = fr2.find(f => String(f.ord).includes("162091632"));
  console.log("In FR2:", f2 ? JSON.stringify(f2) : "NOT FOUND");
}
'
"""
stdin, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:\n", stdout.read().decode('utf-8', errors='ignore'))
print("STDERR:\n", stderr.read().decode('utf-8', errors='ignore'))
ssh.close()
