const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', async () => {
  const query = `
    const r = db.clean_account_records.findOne({ maTKGD: "003C2886699" });
    print("=== RECORD 003C2886699 ===");
    print("ketLuan:", JSON.stringify(r.ketLuan));
    print("noiDungMail:", JSON.stringify(r.noiDungMail));
    print("hopDong:", JSON.stringify(r.hopDong));
    print("canCuoc:", JSON.stringify(r.canCuoc));
    print("ms:", JSON.stringify(r.ms));
    
    // Also check rawMail
    const mail = db.raw_account_mails.findOne({ bodyRawText: /003C2886699/i });
    if (mail) {
      print("=== RAW MAIL ===");
      print("Subject:", mail.subject);
      print("Body:", mail.bodyRawText.substring(0, 500));
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
