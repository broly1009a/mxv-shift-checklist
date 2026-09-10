const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', async () => {
  const query = `
    const recs = db.clean_account_records.find({ 
      $or: [{ maTKGD: /003C2886699/i }, { maTKGDBase: /003C2886699/i }] 
    }).toArray();
    print("Found", recs.length, "records for 003C2886699:");
    recs.forEach((r, i) => {
      print("--- Record", i + 1, "---");
      print("ID:", r._id, "maTKGD:", r.maTKGD, "maTKGDBase:", r.maTKGDBase, "accountType:", r.accountType, "batchDate:", r.batchDate);
      print("Status:", r.ketLuan?.trangThai);
      print("Errors:", JSON.stringify(r.ketLuan?.danhSachLoi));
      print("Mail name:", r.noiDungMail?.tenTaiKhoan);
      print("HD name:", r.hopDong?.hoVaTen);
      print("CCCD name:", r.canCuoc?.hoVaTen);
      print("MS name:", r.ms?.hoVaTen);
    });
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
