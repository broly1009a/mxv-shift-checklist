const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remotePython = `
import os

print("=== FINDING TradingCheck or T10.2026 ===")
for root, dirs, files in os.walk("/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/"):
    for d in dirs:
        if "TradingCheck" in d or "T10" in d or "T11" in d or "Backup" in d:
            print("DIR:", os.path.join(root, d))
    if len(root.split(os.sep)) > 7:
        continue
`;

  const cmd = `cat << 'EOF' > /tmp/find_paths.py\n${remotePython}\nEOF\npython3 /tmp/find_paths.py\nrm -f /tmp/find_paths.py`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

