const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remotePython = `
import os

ms_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026"
acm_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026/T10.2026"

print("=== MS T10.2026 DAYS ===")
if os.path.exists(ms_dir):
    days = sorted(os.listdir(ms_dir))
    print(f"Total {len(days)} days: {days}")
    for d in days:
        dp = os.path.join(ms_dir, d)
        if os.path.isdir(dp):
            files = os.listdir(dp)
            print(f"  Day {d}: {files}")
else:
    print("MS T10.2026 NOT FOUND")

print("\\n=== ACM T10.2026 DAYS ===")
if os.path.exists(acm_dir):
    days = sorted(os.listdir(acm_dir))
    print(f"Total {len(days)} days: {days}")
    for d in days:
        dp = os.path.join(acm_dir, d)
        if os.path.isdir(dp):
            files = os.listdir(dp)
            print(f"  Day {d}: {files}")
else:
    print("ACM T10.2026 NOT FOUND")
`;

  const cmd = `cat << 'EOF' > /tmp/inspect_t10.py\n${remotePython}\nEOF\npython3 /tmp/inspect_t10.py\nrm -f /tmp/inspect_t10.py`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

