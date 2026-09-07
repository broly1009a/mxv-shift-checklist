const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const queryCmd = `mongosh "mongodb://127.0.0.1:27017/mxv_shift_checklist" --quiet --eval '
    const codes = ["036C8888871", "036C0141369", "036C8253769"];
    const docs = db.clean_account_records.find({ maTKGDBase: { $in: codes } }).toArray();
    docs.forEach(d => {
      print("==================================================");
      print("TKGD:", d.maTKGD, "| Base:", d.maTKGDBase);
      print("Ten Mail:", d.noiDungMail?.tenTaiKhoan);
      print("HopDong:", JSON.stringify(d.hopDong, null, 2));
      print("CanCuoc:", JSON.stringify(d.canCuoc, null, 2));
      print("KetLuan:", JSON.stringify(d.ketLuan, null, 2));
    });
  '`;

  conn.exec(queryCmd, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    let out = '';
    stream.on('data', chunk => out += chunk.toString());
    stream.stderr.on('data', errChunk => console.error('STDERR:', errChunk.toString()));
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
