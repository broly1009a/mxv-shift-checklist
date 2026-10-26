const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `python3 -c "
import os, glob, openpyxl

paths = glob.glob('/mnt/qlgd-it/**/23.10/**', recursive=True)
print('Total files in 23.10:', len(paths))
for p in paths:
    if any(k in os.path.basename(p).lower() for k in ['ql', 'eod', 'tttt', 'nr']):
        print(p)
"`;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 15000
});
