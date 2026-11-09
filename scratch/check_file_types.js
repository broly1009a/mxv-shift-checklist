const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remotePython = `
import os

p1 = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026/T10.2026/01.10/Straits.csv"
p2 = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026/T10.2026/20.10/Fill.xlsx"
p3 = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026/T10.2026/20.10/Fill.xls"

for p in [p1, p2, p3]:
    if os.path.exists(p):
        print(f"File {p} size = {os.path.getsize(p)}")
        with open(p, "rb") as f:
            print("First 200 bytes:", f.read(200))
`;

  const cmd = `cat << 'EOF' > /tmp/check_file_type.py\n${remotePython}\nEOF\npython3 /tmp/check_file_type.py\nrm -f /tmp/check_file_type.py`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

