const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

const ms_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026";
const days = fs.readdirSync(ms_dir).filter(d => /^\\d{2}\\.\\d{2}$/.test(d)).sort();

console.log("THƯ MỤC | SỐ DÒNG | NGÀY GIAO DỊCH TRONG FILE (DATES FOUND)");
console.log("---------------------------------------------------------------");

for (const d of days) {
    const fp = path.join(ms_dir, d, 'DSGD.xlsx');
    if (!fs.existsSync(fp)) {
        console.log(\`\${d}     |   NO FILE\`);
        continue;
    }
    const wb = XLSX.readFile(fp);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const dates = new Set();
    rows.forEach(r => {
        const t = r['Ngày giờ thực hiện'] || r['Ngày giờ đặt lệnh'];
        if (t) dates.add(String(t).substring(0, 10));
    });
    console.log(\`\${d}     | \${String(rows.length).padStart(7)} | \${Array.from(dates).slice(0, 3).join(', ')}\`);
}
`;

  const cmd = `cat << 'EOF' > /tmp/check_ms_dates.js\n${remoteNode}\nEOF\nnode /tmp/check_ms_dates.js\nrm -f /tmp/check_ms_dates.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stderr.write(d.toString()), stream.on('data', d => process.stdout.write(d.toString())));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

