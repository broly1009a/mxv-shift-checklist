const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `
    echo "=== FOLDERS IN /mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/ ==="
    ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong"
    echo ""
    echo "=== FILES IN Thong ke so lot giao dich ==="
    ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke so lot giao dich"
    echo ""
    if [ -d "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke ccp" ]; then
      echo "=== FILES IN Thong ke ccp ==="
      ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke ccp"
    else
      echo "=== Thong ke ccp DOES NOT EXIST ==="
    fi
  `;

  conn.exec(remoteCmd, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
});
conn.connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
