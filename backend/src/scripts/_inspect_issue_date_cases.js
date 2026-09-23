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

      console.log("TỔNG SỐ CA LỆCH NGÀY CẤP:", cases.length);

      cases.slice(0, 10).forEach((c, idx) => {
        console.log(\`=== [\${idx+1}] \${c.maTKGD} (\${c.batchDate}) - \${c.hopDong?.hoVaTen || c.canCuoc?.hoVaTen || c.ms?.hoVaTen} ===\`);
        console.log("  Danh sách lỗi:", c.ketLuan?.danhSachLoi);
        console.log("  MS ngày cấp:", c.ms?.ngayCap);
        console.log("  CCCD ngày cấp (OCR):", c.canCuoc?.ngayCap);
        console.log("  Hợp đồng ngày cấp:", c.hopDong?.ngayCap);
        console.log("  CCCD số:", c.canCuoc?.soCCCD, "| MS số:", c.ms?.soCCCD);
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
