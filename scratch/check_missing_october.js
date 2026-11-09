const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');

const baseFolders = [
    "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026",
    "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CQG/Futures/2026/T10.2026",
    "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026",
    "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026",
    "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026",
    "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/CCP/Futures/2026/T10.2026"
];

console.log("=== KIỂM TRA SỰ TỒN TẠI FILE Ở CÁC NGÀY 13.10 -> 22.10 ===");
const targetDays = ['13.10', '14.10', '15.10', '16.10', '19.10', '20.10', '21.10', '22.10'];

targetDays.forEach(d => {
    console.log(\`\\n--- NGÀY \${d} ---\`);
    baseFolders.forEach(bf => {
        const dp = path.join(bf, d);
        if (fs.existsSync(dp)) {
            const files = fs.readdirSync(dp);
            const shortBf = bf.replace('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/', '');
            console.log(\`  [\${shortBf}]: \${files.length} files -> \${files.slice(0, 5).join(', ')}\`);
        }
    });
});
`;

  const cmd = `cat << 'EOF' > /tmp/check_missing_days.js\n${remoteNode}\nEOF\nnode /tmp/check_missing_days.js\nrm -f /tmp/check_missing_days.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

