const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');

const acm_t11 = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026/T11.2026";
const ms_t11 = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T11.2026";

console.log("=== T11 ACM FILES ===");
fs.readdirSync(acm_t11).forEach(d => {
    const p = path.join(acm_t11, d);
    if (fs.statSync(p).isDirectory()) {
        console.log(\`Day \${d}: \${fs.readdirSync(p).join(', ')}\`);
    }
});
`;

  const cmd = `cat << 'EOF' > /tmp/check_t11_files.js\n${remoteNode}\nEOF\nnode /tmp/check_t11_files.js\nrm -f /tmp/check_t11_files.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

