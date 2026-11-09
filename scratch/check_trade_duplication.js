const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

const ms_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026";

function getTradeIds(d) {
    const fp = path.join(ms_dir, d, 'DSGD.xlsx');
    if (!fs.existsSync(fp)) return new Set();
    const wb = XLSX.readFile(fp);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const s = new Set();
    rows.forEach(r => {
        const id = r['Mã giao dịch'] || r['Mã lệnh'];
        if (id) s.add(String(id));
    });
    return s;
}

const s01 = getTradeIds('01.10');
const s02 = getTradeIds('02.10');
const s03 = getTradeIds('03.10');
const s05 = getTradeIds('05.10');
const s06 = getTradeIds('06.10');

console.log(\`01.10 trades: \${s01.size}\`);
console.log(\`02.10 trades: \${s02.size}\`);
console.log(\`03.10 trades: \${s03.size}\`);
console.log(\`05.10 trades: \${s05.size}\`);

// Check intersection
let inter02_03 = 0;
s02.forEach(id => { if (s03.has(id)) inter02_03++; });
console.log(\`Trùng giữa 02.10 và 03.10: \${inter02_03} trades\`);

let inter01_03 = 0;
s01.forEach(id => { if (s03.has(id)) inter01_03++; });
console.log(\`Trùng giữa 01.10 và 03.10: \${inter01_03} trades\`);

const s09 = getTradeIds('09.10');
const s10 = getTradeIds('10.10');
const s12 = getTradeIds('12.10');
console.log(\`\\n09.10 trades: \${s09.size}\`);
console.log(\`10.10 trades: \${s10.size}\`);
console.log(\`12.10 trades: \${s12.size}\`);
let inter09_10 = 0;
s09.forEach(id => { if (s10.has(id)) inter09_10++; });
console.log(\`Trùng giữa 09.10 và 10.10: \${inter09_10} trades\`);

let inter10_12 = 0;
s10.forEach(id => { if (s12.has(id)) inter10_12++; });
console.log(\`Trùng giữa 10.10 và 12.10: \${inter10_12} trades\`);
`;

  const cmd = `cat << 'EOF' > /tmp/check_dup_trades.js\n${remoteNode}\nEOF\nnode /tmp/check_dup_trades.js\nrm -f /tmp/check_dup_trades.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

