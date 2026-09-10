const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', async () => {
  const query = `
    const recs = db.clean_account_records.find({ 
      $or: [{ maTKGD: /003C1311117/i }, { maTKGDBase: /003C1311117/i }] 
    }).toArray();
    print("Found", recs.length, "records for 003C1311117:");
    recs.forEach((r, i) => {
      print("--- Record", i + 1, "---");
      print("ID:", r._id, "batchDate:", r.batchDate, "Status:", r.ketLuan?.trangThai);
      print("Errors:", JSON.stringify(r.ketLuan?.danhSachLoi));
      print("Mail name:", r.noiDungMail?.tenTaiKhoan);
      print("HD name:", r.hopDong?.hoVaTen);
      print("CCCD name:", r.canCuoc?.hoVaTen);
      print("MS name:", r.ms?.hoVaTen);
    });

    const mail = db.raw_account_mails.findOne({ bodyRawText: /003C1311117/i });
    if (mail) {
      print("=== RAW MAIL 003C1311117 ===");
      print("Subject:", mail.subject);
      print("Body:\n", mail.bodyRawText);
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
