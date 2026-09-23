const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `cd /opt/mxv-checklist/backend && node -e '
    require("dotenv").config();
    const { MongoClient } = require("mongodb");

    (async () => {
      const client = new MongoClient(process.env.MONGODB_URI);
      await client.connect();
      const col = client.db().collection("clean_account_records");
      
      const cases = await col.find({
        "ketLuan.trangThai": "LECH",
        "ketLuan.danhSachLoi": { $elemMatch: { $regex: "Lệch họ tên", $options: "i" } }
      }).toArray();

      console.log("TỔNG SỐ CA LỆCH HỌ TÊN:", cases.length);

      cases.forEach((c, i) => {
        const errs = (c.ketLuan?.danhSachLoi || []).filter(e => /họ tên/i.test(e));
        console.log(\`=== [\${i+1}] \${c.maTKGD} (\${c.batchDate}) ===\`);
        console.log("   Lỗi:", errs.join("; "));
        console.log("   HĐ:", JSON.stringify(c.hopDong?.hoVaTen));
        console.log("   CCCD:", JSON.stringify(c.canCuoc?.hoVaTen));
        console.log("   MS:", JSON.stringify(c.ms?.hoVaTen || c.ms?.tenTKGD));
        console.log("   Mail:", JSON.stringify(c.noiDungMail?.tenTaiKhoan));
      });

      await client.close();
    })();
  '`;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
