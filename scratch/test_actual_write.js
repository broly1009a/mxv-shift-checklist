const path = require('path');
const { Client } = require(path.join(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
    const fs = require('fs');
    const path = require('path');
    const target = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/ACM';
    const testFile = path.join(target, '.write_test_' + Date.now());
    console.log('Testing write to:', testFile);
    try {
      fs.writeFileSync(testFile, 'test');
      console.log('Write SUCCESS!');
      fs.unlinkSync(testFile);
      console.log('Unlink SUCCESS!');
    } catch (e) {
      console.log('Write FAILED:', e.message, e.code);
    }
  `;

  conn.exec(`cat << 'EOF' > /tmp/test_actual_write.js\n${remoteScript}\nEOF\nnode /tmp/test_actual_write.js`, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});

