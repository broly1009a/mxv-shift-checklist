const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const script = `
    const fs = require('fs');
    const path = require('path');
    const xlsx = require('xlsx');

    // Tìm thư mục 28.10
    const basePath = '/opt/mxv-checklist/data/backup';
    const findFiles = (dir) => {
      let results = [];
      if (!fs.existsSync(dir)) return results;
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          results = results.concat(findFiles(full));
        } else {
          results.push(full);
        }
      }
      return results;
    };

    // Tìm các file trong hệ thống có chứa 28.10 hoặc 28_10
    const allFiles = findFiles('/opt/mxv-checklist');
    const targetFiles = allFiles.filter(f => f.includes('28.10') || f.includes('28_10') || f.includes('28-10') || f.includes('20261028'));
    console.log('Target files found:', targetFiles.filter(f => f.endsWith('.xlsx') || f.endsWith('.csv')));
  `;

  conn.exec(`cd /opt/mxv-checklist/backend && node -e "${script.replace(/\n/g, ' ')}"`, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
