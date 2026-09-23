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
        "ketLuan.danhSachLoi": { $regex: "\\[PHÁT HIỆN CCCD BẤT THƯỜNG\\]" }
      }).toArray();

      console.log("TỔNG SỐ CA BỊ CẢNH BÁO CCCD BẤT THƯỜNG:", cases.length);

      cases.forEach((c, idx) => {
        const bcaErrors = (c.ketLuan?.danhSachLoi || []).filter(e => e.includes("[PHÁT HIỆN CCCD BẤT THƯỜNG]"));
        console.log(\`=== [\${idx+1}] \${c.maTKGD} (\${c.batchDate}) - \${c.hopDong?.hoVaTen || c.canCuoc?.hoVaTen || c.ms?.hoVaTen} ===\`);
        console.log("  Cảnh báo BCA:", bcaErrors);
        console.log("  CCCD OCR:", c.canCuoc?.soCCCD, "| DOB:", c.canCuoc?.rawNgaySinh || c.canCuoc?.ngaySinh, "| Issue:", c.canCuoc?.rawNgayCap || c.canCuoc?.ngayCap);
        console.log("  HĐ CCCD:", c.hopDong?.soCanCuoc, "| DOB:", c.hopDong?.rawNgaySinh || c.hopDong?.ngaySinh, "| Issue:", c.hopDong?.rawNgayCap || c.hopDong?.ngayCap);
        console.log("  MS CCCD:", c.ms?.soCMND_HoChieu, "| DOB:", c.ms?.rawNgaySinh || c.ms?.ngaySinh, "| Issue:", c.ms?.rawNgayCap || c.ms?.ngayCap);
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
