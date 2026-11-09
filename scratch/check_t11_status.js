const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');

const ms_t11 = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T11.2026";
const acm_t11 = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026/T11.2026";
const tc_t11 = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T11.2026";
const tc_acm_t11 = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/ACM/Futures/2026/T11.2026";

console.log("=== CHECKING MONTH 11 FOLDERS ===");
[ms_t11, acm_t11, tc_t11, tc_acm_t11].forEach(p => {
    if (fs.existsSync(p)) {
        const days = fs.readdirSync(p);
        console.log(\`Path: \${p} (days=\${days.length}): \${days.join(', ')}\`);
    } else {
        console.log(\`Path: \${p} DOES NOT EXIST\`);
    }
});
`;

  const cmd = `cat << 'EOF' > /tmp/check_t11_folders.js\n${remoteNode}\nEOF\nnode /tmp/check_t11_folders.js\nrm -f /tmp/check_t11_folders.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

