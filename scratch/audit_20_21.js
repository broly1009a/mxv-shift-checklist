const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');

const dirs = [
    { name: 'Backup MS/Futures', p: '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026' },
    { name: 'TradingCheck/Futures', p: '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026' },
    { name: 'Backup CQG/Futures', p: '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CQG/Futures/2026/T10.2026' },
    { name: 'TradingCheck/CQG', p: '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026' },
    { name: 'Backup CCP', p: '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026' },
    { name: 'TradingCheck/CCP', p: '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/CCP/Futures/2026/T10.2026' }
];

console.log("=== KIỂM TRA TOÀN DIỆN NGÀY 20.10 VÀ 21.10 ===");
for (const day of ['20.10', '21.10']) {
    console.log(\`\\n================= NGÀY \${day} =================\`);
    dirs.forEach(d => {
        const full = path.join(d.p, day);
        if (fs.existsSync(full)) {
            const files = fs.readdirSync(full);
            console.log(\`[\${d.name}]: \${files.length} files\`);
            files.forEach(f => {
                const st = fs.statSync(path.join(full, f));
                console.log(\`    - \${f} (\${(st.size/1024).toFixed(1)} KB)\`);
            });
        } else {
            console.log(\`[\${d.name}]: THƯ MỤC KHÔNG TỒN TẠI\`);
        }
    });
}
`;

  const cmd = `cat << 'EOF' > /tmp/audit_20_21.js\n${remoteNode}\nEOF\nnode /tmp/audit_20_21.js\nrm -f /tmp/audit_20_21.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

