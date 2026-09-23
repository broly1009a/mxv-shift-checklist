const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `cd /opt/mxv-checklist/backend && node -e '
    try {
      require("dotenv").config();
      const { MongoClient } = require("mongodb");
      const helper = require("./dist/modules/bot-engine/helpers/tkgd-reconcile-rules.helper");

      (async () => {
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const col = client.db().collection("clean_account_records");
        
        const c = await col.findOne({ maTKGD: "012C4253346" });
        const res = helper.evaluateRecordReconciliationRule(c);
        console.log("KẾT QUẢ EVALUATE HIỆN TẠI VỚI 012C4253346:");
        console.log("trangThai:", res.trangThai);
        console.log("danhSachLoi:", res.danhSachLoi);
        console.log("ghiChuHeThong:", res.ghiChuHeThong);

        await client.close();
      })();
    } catch (e) {
      console.error("CATCH ERR:", e);
    }
  '`;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    let errOut = '';
    stream.on('data', d => out += d.toString());
    stream.stderr.on('data', d => errOut += d.toString());
    stream.on('close', (code) => {
      console.log('EXIT:', code);
      console.log('OUT:', out);
      if (errOut) console.log('ERR:', errOut);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
