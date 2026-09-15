const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', async () => {
  const query = `
    const recs = db.clean_account_records.find({ 
      $or: [
        { "ketLuan.danhSachLoi": /HOANGXSTHANH/i },
        { "hopDong.hoVaTen": /HOANGXSTHANH/i },
        { "canCuoc.hoVaTen": /HOANGXSTHANH/i },
        { "noiDungMail.tenTaiKhoan": /HOANGXSTHANH/i }
      ]
    }).toArray();
    print("Found", recs.length, "records with HOANGXSTHANH:");
    recs.forEach(r => {
      print("ID:", r._id, "maTKGD:", r.maTKGD, "batchDate:", r.batchDate, "Status:", r.ketLuan?.trangThai, "Errors:", JSON.stringify(r.ketLuan?.danhSachLoi));
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
