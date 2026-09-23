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
        "ketLuan.danhSachLoi": { $regex: "ngày cấp", $options: "i" }
      }).toArray();

      cases.slice(10, 30).forEach((c, idx) => {
        const fmt = d => d ? new Date(d).toLocaleDateString("vi-VN") : "---";
        console.log(\`[\${idx+11}] \${c.maTKGD} (\${c.hopDong?.hoVaTen || c.canCuoc?.hoVaTen || c.ms?.hoVaTen}) | OCR: \${fmt(c.canCuoc?.ngayCap)} | MS: \${fmt(c.ms?.ngayCap)} | HĐ: \${fmt(c.hopDong?.ngayCap)}\`);
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
