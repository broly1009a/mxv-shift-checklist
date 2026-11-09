const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

const frPath1 = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CQG/Futures/2026/T10.2026/20.10/FR.xlsx";
const frPath2 = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026/20.10/FR.xlsx";

for (const fp of [frPath1, frPath2]) {
    if (fs.existsSync(fp)) {
        const wb = XLSX.readFile(fp);
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        let lots = 0;
        rows.forEach(r => {
            lots += Number(r['Qty'] || r['Quantity'] || r['Volume'] || r['Lot'] || 0);
        });
        console.log(\`FR file \${fp}: \${rows.length} rows, \${lots} lots\`);
    } else {
        console.log(\`File \${fp} NOT FOUND\`);
    }
}
`;

  const cmd = `cat << 'EOF' > /tmp/check_2010_fr.js\n${remoteNode}\nEOF\nnode /tmp/check_2010_fr.js\nrm -f /tmp/check_2010_fr.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

