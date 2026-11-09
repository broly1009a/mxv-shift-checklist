const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

const fp = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026/20.10/FR.xlsx";
const wb = XLSX.readFile(fp);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
console.log("FR rows:", rows.length);
if (rows.length > 0) {
    console.log("FR sample row:", rows[0]);
    console.log("FR last row:", rows[rows.length - 1]);
}
`;

  const cmd = `cat << 'EOF' > /tmp/check_fr_content.js\n${remoteNode}\nEOF\nnode /tmp/check_fr_content.js\nrm -f /tmp/check_fr_content.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

