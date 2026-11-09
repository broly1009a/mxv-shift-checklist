const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

const ms_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026";

for (const d of ['03.10', '10.10']) {
    const fp = path.join(ms_dir, d, 'DSGD.xlsx');
    console.log(\`=== KIỂM TRA THỜI GIAN KHỚP LỆNH TRONG \${d}/DSGD.xlsx ===\`);
    if (fs.existsSync(fp)) {
        const wb = XLSX.readFile(fp);
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        console.log(\`Total rows: \${rows.length}\`);
        const times = rows.map(r => r['Ngày giờ thực hiện'] || r['Ngày giờ đặt lệnh']).filter(Boolean);
        console.log(\`First 5 trade times: \`, times.slice(0, 5));
        console.log(\`Last 5 trade times: \`, times.slice(-5));
        
        // Kiem tra gio: tat ca co phai truoc 6h sang khong?
        let before6am = 0;
        let after6am = 0;
        times.forEach(t => {
            const timePart = String(t).split(' ')[1] || '';
            const hour = parseInt(timePart.split(':')[0], 10);
            if (hour < 6) before6am++;
            else after6am++;
        });
        console.log(\`Lệnh trước 6h sáng: \${before6am} | Lệnh sau 6h sáng: \${after6am}\`);
    }
}
`;

  const cmd = `cat << 'EOF' > /tmp/check_weekend_hours.js\n${remoteNode}\nEOF\nnode /tmp/check_weekend_hours.js\nrm -f /tmp/check_weekend_hours.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

