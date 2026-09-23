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
        "ketLuan.danhSachLoi": { $elemMatch: { $regex: "Lệch ngày sinh", $options: "i" } }
      }).toArray();

      console.log("TỔNG SỐ CA LỆCH NGÀY SINH:", cases.length);

      const list = [];
      for (const c of cases) {
        const errs = (c.ketLuan?.danhSachLoi || []).filter(e => /ngày sinh/i.test(e));
        const fmt = d => d ? new Date(d).toLocaleDateString("vi-VN") : "---";
        list.push({
          code: c.maTKGD,
          batchDate: c.batchDate,
          name: c.hopDong?.hoVaTen || c.canCuoc?.hoVaTen || c.ms?.hoVaTen,
          errors: errs,
          ocrDob: c.canCuoc?.rawNgaySinh || fmt(c.canCuoc?.ngaySinh),
          hdDob: c.hopDong?.rawNgaySinh || fmt(c.hopDong?.ngaySinh),
          msDob: c.ms?.rawNgaySinh || fmt(c.ms?.ngaySinh),
          cccdNumber: c.canCuoc?.soCCCD || c.hopDong?.soCanCuoc || c.ms?.soCMND_HoChieu
        });
      }

      list.forEach((x, i) => {
        console.log(\`[\${i+1}] \${x.code} (\${x.name}) @ \${x.batchDate}\`);
        console.log("   Lỗi:", x.errors.join("; "));
        console.log(\`   OCR: \${x.ocrDob} | HĐ: \${x.hdDob} | MS: \${x.msDob} | CCCD: \${x.cccdNumber}\`);
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
