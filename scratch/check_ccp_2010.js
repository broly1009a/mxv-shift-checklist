const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

const ccpFp = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/CCP/Futures/2026/T10.2026/20.10/DSGD_20.10.2026.xlsx";
if (fs.existsSync(ccpFp)) {
    const wb = XLSX.readFile(ccpFp);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    console.log(\`CCP DSGD 20.10: \${rows.length} rows\`);
    if (rows.length > 0) {
        console.log("Headers:", Object.keys(rows[0]));
        let total = 0;
        rows.forEach(r => total += Number(r['KL khớp'] || r['Khối lượng'] || r['Volume'] || 0));
        console.log("Total lots:", total);
    }
}
`;

  const cmd = `cat << 'EOF' > /tmp/check_ccp_2010.js\n${remoteNode}\nEOF\nnode /tmp/check_ccp_2010.js\nrm -f /tmp/check_ccp_2010.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

