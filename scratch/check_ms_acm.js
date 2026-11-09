const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remotePython = `
import os

acm_ms_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/ACM/2026/T10.2026"
print("=== CHECKING /mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/ACM/2026/T10.2026 ===")
if os.path.exists(acm_ms_dir):
    days = sorted(os.listdir(acm_ms_dir))
    print(f"Total days: {len(days)}: {days}")
    for d in days:
        dp = os.path.join(acm_ms_dir, d)
        if os.path.isdir(dp):
            print(f"  Day {d}: {os.listdir(dp)}")
else:
    print("NOT FOUND")

# Also check Backup MS/ACM for other months
parent = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/ACM"
if os.path.exists(parent):
    print("Backup MS/ACM contents:", os.listdir(parent))
    for root, dirs, files in os.walk(parent):
        for d in dirs:
            print("  Subdir:", os.path.join(root, d))
`;

  const cmd = `cat << 'EOF' > /tmp/check_ms_acm.py\n${remotePython}\nEOF\npython3 /tmp/check_ms_acm.py\nrm -f /tmp/check_ms_acm.py`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

