const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    const remoteScript = `
      const mongoose = require('mongoose');
      async function run() {
        await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
        const coll = mongoose.connection.collection('clean_account_records');
        const rawColl = mongoose.connection.collection('raw_account_mails');
        
        const targets = ['003C2795169', '003C1399395', '003C8946619'];
        for (const t of targets) {
          const doc = await coll.findOne({ $or: [{ maTKGD: t }, { maTKGDBase: t }] });
          console.log('\\n==================== ' + t + ' ====================');
          console.log('hopDong:', doc?.hopDong);
          console.log('canCuoc:', doc?.canCuoc);
          console.log('phuLuc:', doc?.phuLuc);
          console.log('ms:', doc?.ms ? { hoVaTen: doc.ms.hoVaTen, soCMND: doc.ms.soCMND_HoChieu, ngaySinh: doc.ms.ngaySinh } : null);
        }

        const rawMails = await rawColl.find({}).toArray();
        console.log('\\nTotal raw mails:', rawMails.length);
        rawMails.forEach(m => {
          console.log('Mail ID:', m.messageId, '| Subj:', m.subject, '| Attachments count:', m.attachments?.length);
          if (m.attachments?.length) {
            console.log('  Attachments:', m.attachments.map(a => a.name));
          }
        });

        await mongoose.disconnect();
      }
      run().catch(console.error);
    `;

    const writeStream = sftp.createWriteStream('/opt/mxv-checklist/backend/inspect_temp.js');
    writeStream.write(remoteScript);
    writeStream.end(() => {
      conn.exec('cd /opt/mxv-checklist/backend && node inspect_temp.js && rm -f inspect_temp.js', (execErr, stream) => {
        let stdout = '';
        stream.on('data', d => stdout += d.toString());
        stream.stderr.on('data', d => stdout += d.toString());
        stream.on('close', () => {
          console.log(stdout);
          conn.end();
        });
      });
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 10000,
});
