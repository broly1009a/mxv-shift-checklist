const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
    const path = require('path');
    const fs = require('fs');

    function resolveStoragePathCrossPlatform(rawPath) {
      if (!rawPath) return rawPath;
      const linuxMountBase = '/mnt/qlgd-it';
      const normalized = rawPath.replace(/\\\\/g, '/');
      if (process.platform !== 'win32') {
        const qlgdMatch = normalized.match(/(?:^|\\/)(quanlygiaodich\\/.*)$/i);
        if (qlgdMatch) return (linuxMountBase + '/' + qlgdMatch[1]).replace(/\\/+/g, '/');
        if (/^[a-zA-Z]:\\/tailieuchung\\/qlgd-it\\/(.*)$/i.test(normalized)) {
          return (linuxMountBase + '/' + normalized.replace(/^[a-zA-Z]:\\/tailieuchung\\/qlgd-it\\//i, '')).replace(/\\/+/g, '/');
        }
        if (/^m:\\/(.*)$/i.test(normalized)) {
          return (linuxMountBase + '/' + normalized.replace(/^m:\\//i, '')).replace(/\\/+/g, '/');
        }
        return normalized;
      }
      return rawPath;
    }

    const rawCeBackupBase = 'M:\\\\Tailieuchung\\\\QLGD-IT\\\\Quanlygiaodich\\\\Tai lieu hoat dong\\\\Backup CE\\\\Futures';
    console.log('rawCeBackupBase:', rawCeBackupBase);

    const ceBackupBase = resolveStoragePathCrossPlatform(rawCeBackupBase);
    console.log('ceBackupBase (Linux):', ceBackupBase);

    const parentRoot = path.dirname(path.dirname(ceBackupBase));
    console.log('parentRoot:', parentRoot);

    const defaultAcmLot = path.join(parentRoot, 'Thong ke ccp', 'output', 'Thong ke so lot giao dich ACM 2026.xlsx');
    console.log('defaultAcmLot:', defaultAcmLot);
    console.log('defaultAcmLot exists?', fs.existsSync(defaultAcmLot));

    const defaultAcmGtgd = path.join(parentRoot, 'Thong ke ccp', 'output', 'Thong ke gia tri giao dich ACM 2026.xlsx');
    console.log('defaultAcmGtgd:', defaultAcmGtgd);
    console.log('defaultAcmGtgd exists?', fs.existsSync(defaultAcmGtgd));
  `;

  conn.exec(`cat << 'EOF' > /tmp/test_cross.js\n${remoteScript}\nEOF\nnode /tmp/test_cross.js\nrm -f /tmp/test_cross.js`, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
});
conn.connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
