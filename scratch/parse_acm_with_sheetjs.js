const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

const tc_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/ACM/Futures/2026/T10.2026";
const bk_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026/T10.2026";

const daysSet = new Set();
if (fs.existsSync(tc_dir)) fs.readdirSync(tc_dir).forEach(d => daysSet.add(d));
if (fs.existsSync(bk_dir)) fs.readdirSync(bk_dir).forEach(d => daysSet.add(d));

const days = Array.from(daysSet).filter(d => /^\\d{2}\\.\\d{2}$/.test(d)).sort();

let grandTotal = 0;
const memberMap = {};

for (const d of days) {
    const p1 = path.join(tc_dir, d);
    const p2 = path.join(bk_dir, d);
    
    let targetFile = null;
    for (const folder of [p1, p2]) {
        if (!fs.existsSync(folder)) continue;
        for (const f of ['Fill.xlsx', 'Fill.xls', 'Straits.csv']) {
            const fp = path.join(folder, f);
            if (fs.existsSync(fp) && fs.statSync(fp).size > 1000) {
                targetFile = fp;
                break;
            }
        }
        if (targetFile) break;
    }
    
    if (!targetFile) {
        console.log(\`Day \${d}: NO VALID FILE\`);
        continue;
    }
    
    try {
        const wb = XLSX.readFile(targetFile);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        
        let dayLot = 0;
        for (const r of rows) {
            // Check member
            const m = String(r['Trading Firm Id'] || r['Firm'] || r['Member'] || r['Account'] || '').trim().substring(0, 3);
            const lot = Number(r['Volume'] || r['Qty'] || r['Lot'] || 0);
            if (lot > 0) {
                dayLot += lot;
                memberMap[m] = (memberMap[m] || 0) + lot;
            }
        }
        console.log(\`Day \${d} [\${path.basename(targetFile)}]: \${rows.length} rows, \${dayLot.toLocaleString()} lots\`);
        grandTotal += dayLot;
    } catch (e) {
        console.log(\`Day \${d} ERROR reading \${targetFile}: \${e.message}\`);
    }
}

console.log('==================================================');
console.log(\`GRAND TOTAL ACM LOTS IN OCTOBER: \${grandTotal.toLocaleString()} lots\`);
console.log('Top Members:');
Object.entries(memberMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([m, v]) => console.log(\`  TVKD \${m}: \${v.toLocaleString()} lots\`));
`;

  const cmd = `cat << 'EOF' > /tmp/parse_acm_node.js\n${remoteNode}\nEOF\nnode /tmp/parse_acm_node.js\nrm -f /tmp/parse_acm_node.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

