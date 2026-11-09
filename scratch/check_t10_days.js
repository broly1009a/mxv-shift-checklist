const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remotePython = `
import os
import glob

print("=== CHECKING BACKUP DIRECTORIES FOR T10.2026 ===")
base_paths = [
    "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup/TradingCheck/Futures/2026/T10.2026",
    "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup/TradingCheck/CCP/2026/T10.2026",
    "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026/T10.2026",
    "/opt/mxv-checklist/data/TradingCheck/Futures/2026/T10.2026",
    "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke so lot giao dich"
]

for bp in base_paths:
    if os.path.exists(bp):
        items = sorted(os.listdir(bp))
        print(f"Path: {bp} (total {len(items)} items)")
        print("  Items:", items[:10], "... (last:)", items[-5:])
    else:
        print(f"Path: {bp} DOES NOT EXIST")

print("\\n=== CHECKING DSGD.xlsx FILES IN /mnt/qlgd-it/.../T10.2026 ===")
ms_path = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup/TradingCheck/Futures/2026/T10.2026"
if os.path.exists(ms_path):
    days = sorted(os.listdir(ms_path))
    for d in days:
        day_dir = os.path.join(ms_path, d)
        if os.path.isdir(day_dir):
            files = os.listdir(day_dir)
            dsgd = [f for f in files if "DSGD" in f or "dsgd" in f]
            print(f"  Day {d}: files={len(files)}, dsgd={dsgd}")
`;

  const cmd = `cat << 'EOF' > /tmp/check_t10_dirs.py\n${remotePython}\nEOF\npython3 /tmp/check_t10_dirs.py\nrm -f /tmp/check_t10_dirs.py`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

