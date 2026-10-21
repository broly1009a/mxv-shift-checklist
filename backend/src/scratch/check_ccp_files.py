import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26')

cmd = """
node -e '
const fs = require("fs");
const path = require("path");

function listDir(d) {
  console.log("=== Listing:", d);
  if (!fs.existsSync(d)) {
    console.log("NOT FOUND");
    return;
  }
  const files = fs.readdirSync(d);
  files.forEach(f => {
    const full = path.join(d, f);
    const stat = fs.statSync(full);
    console.log(`- ${f} (${stat.size} bytes, mtime: ${stat.mtime.toISOString()})`);
  });
}

listDir("/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/20.10");
listDir("/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/CCP/Futures/2026/T10.2026/20.10");
'
"""
stdin, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:\n", stdout.read().decode('utf-8', errors='ignore'))
print("STDERR:\n", stderr.read().decode('utf-8', errors='ignore'))
ssh.close()
