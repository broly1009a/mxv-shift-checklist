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

for (const d of days) {
    const p1 = path.join(tc_dir, d);
    const p2 = path.join(bk_dir, d);
    
    const allFiles = [];
    [p1, p2].forEach(folder => {
        if (!fs.existsSync(folder)) return;
        fs.readdirSync(folder).forEach(f => {
            const fp = path.join(folder, f);
            const stat = fs.statSync(fp);
            if (stat.isFile() && (f.includes('Fill') || f.includes('Straits') || f.includes('EOD') || f.endsWith('.xls') || f.endsWith('.xlsx') || f.endsWith('.csv'))) {
                allFiles.push({ name: f, path: fp, size: stat.size });
            }
        });
    });
    
    console.log(\`=== DAY \${d} ===\`);
    for (const f of allFiles) {
        let rows = 0;
        let lots = 0;
        try {
            const wb = XLSX.readFile(f.path);
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(sheet);
            rows = data.length;
            for (const r of data) {
                lots += Number(r['Volume'] || r['Qty'] || r['Lot'] || 0);
            }
        } catch(e) {
            rows = 'ERR: ' + e.message;
        }
        console.log(\`  \${f.name} (\${(f.size/1024).toFixed(1)} KB): rows=\${rows}, lots=\${lots}\`);
    }
}
`;

  const cmd = `cat << 'EOF' > /tmp/check_all_acm_files.js\n${remoteNode}\nEOF\nnode /tmp/check_all_acm_files.js\nrm -f /tmp/check_all_acm_files.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

