const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `cd /opt/mxv-checklist/backend && node -e '
    require("dotenv").config();
    const { MongoClient } = require("mongodb");
    const fs = require("fs");
    const path = require("path");

    (async () => {
      const client = new MongoClient(process.env.MONGODB_URI);
      await client.connect();
      const col = client.db().collection("clean_account_records");
      
      const cases = await col.find({
        "ketLuan.trangThai": "LECH",
        $or: [
          { "ketLuan.danhSachLoi": { $regex: "thiếu CCCD", $options: "i" } },
          { "ketLuan.danhSachLoi": { $regex: "Không đọc được số CCCD", $options: "i" } },
          { "ketLuan.danhSachLoi": { $regex: "Chưa có ảnh CCCD", $options: "i" } }
        ]
      }).toArray();

      console.log("TỔNG SỐ CA THIẾU/KHÔNG ĐỌC ĐƯỢC CCCD:", cases.length);

      const baseDir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem";
      const report = [];

      for (const c of cases) {
        const accDir = path.join(baseDir, c.batchDate || "", c.maTKGD || "");
        let files = [];
        if (fs.existsSync(accDir)) {
          files = fs.readdirSync(accDir).map(f => {
            const stat = fs.statSync(path.join(accDir, f));
            return { name: f, size: stat.size };
          });
        }

        report.push({
          code: c.maTKGD,
          batchDate: c.batchDate,
          tvkd: c.maTKGD ? c.maTKGD.substring(0, 3) : "---",
          name: c.hopDong?.hoVaTen || c.canCuoc?.hoVaTen || c.ms?.hoVaTen || c.noiDungMail?.tenTaiKhoan,
          errors: c.ketLuan?.danhSachLoi || [],
          fileCount: files.length,
          files: files.map(f => f.name + " (" + Math.round(f.size/1024) + "KB)")
        });
      }

      let hasCccdGhep = 0;
      let hasPdfOnly = 0;
      let hasCustomerImage = 0;
      let hasMsOnly = 0;
      let noFilesAtAll = 0;

      report.forEach(r => {
        if (r.fileCount === 0) noFilesAtAll++;
        else if (r.files.some(f => f.includes("CCCD_ghep") || f.includes("ghep"))) hasCccdGhep++;
        else if (r.files.some(f => f.toLowerCase().includes("cccd") && !f.includes("_MS_"))) hasCustomerImage++;
        else if (r.files.every(f => f.includes("_MS_") || f.includes(".pdf"))) {
          if (r.files.some(f => f.includes(".pdf"))) hasPdfOnly++;
          else hasMsOnly++;
        }
      });

      console.log("PHÂN LOẠI FILE TRÊN ĐĨA:");
      console.log("- Có file CCCD_ghep:", hasCccdGhep);
      console.log("- Có file ảnh khách có từ CCCD:", hasCustomerImage);
      console.log("- Chỉ có file PDF (+ thumbnail MS):", hasPdfOnly);
      console.log("- Chỉ có thumbnail MS (không có file khách):", hasMsOnly);
      console.log("- Hoàn toàn không có file:", noFilesAtAll);

      console.log("\\n--- CHI TIẾT 15 CA ĐẦU TIÊN ---");
      report.slice(0, 15).forEach((r, i) => {
        console.log("[" + (i+1) + "] " + r.code + " (" + r.tvkd + " - " + r.name + ") @" + r.batchDate);
        console.log("    Lỗi: " + r.errors.join("; "));
        console.log("    Files: " + r.files.join(", "));
      });

      await client.close();
    })();
  '`;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    let errOut = '';
    stream.on('data', d => out += d.toString());
    stream.stderr.on('data', d => errOut += d.toString());
    stream.on('close', (code) => {
      console.log('EXIT CODE:', code);
      console.log(out);
      if (errOut) console.error(errOut);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
