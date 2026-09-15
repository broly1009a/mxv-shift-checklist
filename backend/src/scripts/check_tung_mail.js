const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', async () => {
  const query = `
    const mail = db.raw_account_mails.findOne({ bodyRawText: /003C2886699/i });
    if (mail) {
      print("Mail subject:", mail.subject);
      print("Mail received:", mail.receivedDateTime);
      print("Mail body:\n", mail.bodyRawText);
    } else {
      print("No mail found with 003C2886699");
    }
  `;
  conn.exec(`mongosh mxv_shift_checklist --quiet --eval '${query.replace(/\n/g, " ")}'`, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
