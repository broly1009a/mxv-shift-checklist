const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remotePython = `
import os

p = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/ACM/Futures/2026/T10.2026"
print("=== CHECKING TradingCheck/ACM/Futures/2026/T10.2026 ===")
if os.path.exists(p):
    days = sorted(os.listdir(p))
    print(f"Total days: {len(days)}: {days}")
    for d in days:
        dp = os.path.join(p, d)
        if os.path.isdir(dp):
            print(f"  Day {d}: {os.listdir(dp)}")
else:
    print("NOT FOUND")
`;

  const cmd = `cat << 'EOF' > /tmp/check_tc_acm.py\n${remotePython}\nEOF\npython3 /tmp/check_tc_acm.py\nrm -f /tmp/check_tc_acm.py`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

