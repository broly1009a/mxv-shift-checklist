const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', async () => {
  const query = `
    const lechRecs = db.clean_account_records.find({ 
      batchDate: "2026-09-09", 
      "ketLuan.trangThai": "LECH" 
    }).toArray();
    print("Found", lechRecs.length, "LECH records on 2026-09-09:");
    lechRecs.forEach(r => {
      print("----------------------------------");
      print("maTKGD:", r.maTKGD, "maTKGDBase:", r.maTKGDBase);
      print("Errors:", JSON.stringify(r.ketLuan?.danhSachLoi));
      print("Mail:", r.noiDungMail?.tenTaiKhoan);
      print("HD:", r.hopDong?.hoVaTen);
      print("CCCD:", r.canCuoc?.hoVaTen, "| soCCCD:", r.canCuoc?.soCanCuoc);
      print("MS:", r.ms?.hoVaTen, "| soCMND:", r.ms?.soCMND_HoChieu);
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
