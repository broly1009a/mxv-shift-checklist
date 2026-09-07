const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    const remoteScript = `
      const fs = require('fs');
      const { readPdfText } = require('./dist/modules/bot-engine/helpers/tkgd-doc-extractor.helper');

      async function run() {
        const rawColl = require('mongoose').connection.collection('raw_account_mails');
        await require('mongoose').connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
        const mails = await rawColl.find({ attachments: { $elemMatch: { name: /DANG-QUI|NGUYEN-THI/ } } }).toArray();

        for (const m of mails) {
          console.log('\\n======================================================');
          console.log('Subject:', m.subject);
          for (const att of m.attachments || []) {
            if (att.name.endsWith('.pdf')) {
              console.log('--- PDF File:', att.name, '---');
              if (att.contentBytes) {
                const buf = Buffer.from(att.contentBytes, 'base64');
                const text = await readPdfText(buf);
                console.log('TEXT SNIPPET (first 1000 chars):\\n', text.slice(0, 1000));
              }
            }
          }
        }
        await require('mongoose').disconnect();
      }
      run().catch(console.error);
    `;

    const writeStream = sftp.createWriteStream('/opt/mxv-checklist/backend/debug_pdf.js');
    writeStream.write(remoteScript);
    writeStream.end(() => {
      conn.exec('cd /opt/mxv-checklist/backend && node debug_pdf.js && rm -f debug_pdf.js', (execErr, stream) => {
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
