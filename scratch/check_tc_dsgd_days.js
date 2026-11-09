const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

const tcPath = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026";

for (const d of ['13.10', '14.10', '15.10', '16.10', '20.10', '21.10']) {
    const fp = path.join(tcPath, d, 'DSGD.xlsx');
    if (fs.existsSync(fp)) {
        const wb = XLSX.readFile(fp);
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        let lots = 0;
        let acmLots = 0;
        rows.forEach(r => {
            const acc = String(r['Mã TKGD'] || '').trim().toUpperCase();
            const l = Number(r['KL giao dịch'] || 0);
            if (acc.endsWith('A')) acmLots += l;
            else lots += l;
        });
        console.log(\`TradingCheck Day \${d}/DSGD.xlsx: \${rows.length} rows | CQG: \${lots.toLocaleString()} lots | ACM: \${acmLots.toLocaleString()} lots\`);
    } else {
        console.log(\`TradingCheck Day \${d}/DSGD.xlsx: NOT FOUND\`);
    }
}
`;

  const cmd = `cat << 'EOF' > /tmp/check_tc_dsgd.js\n${remoteNode}\nEOF\nnode /tmp/check_tc_dsgd.js\nrm -f /tmp/check_tc_dsgd.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

