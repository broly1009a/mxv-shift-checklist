const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');

const dp = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/20.10";
console.log("Files in 20.10:", fs.readdirSync(dp));
for (const f of fs.readdirSync(dp)) {
    const st = fs.statSync(path.join(dp, f));
    console.log(\`  \${f}: \${st.size} bytes\`);
}

// Also check CCP
const ccp2010 = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/CCP/Futures/2026/T10.2026/20.10";
if (fs.existsSync(ccp2010)) {
    console.log("CCP files in 20.10:", fs.readdirSync(ccp2010));
}
`;

  const cmd = `cat << 'EOF' > /tmp/check_2010_files.js\n${remoteNode}\nEOF\nnode /tmp/check_2010_files.js\nrm -f /tmp/check_2010_files.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

