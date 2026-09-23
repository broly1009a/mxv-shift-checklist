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

      const baseDir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem";
      
      const tvkdStats = {};

      for (const c of cases) {
        const tvkd = c.maTKGD ? c.maTKGD.substring(0, 3) : "UNKNOWN";
        if (!tvkdStats[tvkd]) {
          tvkdStats[tvkd] = { total: 0, hasCccdPdf: 0, hasPdfOnly: 0, hasImages: 0, hasCccdGhep: 0, samples: [] };
        }
        tvkdStats[tvkd].total++;

        const accDir = path.join(baseDir, c.batchDate || "", c.maTKGD || "");
        let files = [];
        if (fs.existsSync(accDir)) {
          files = fs.readdirSync(accDir);
        }

        const cccdPdf = files.filter(f => f.toLowerCase().endsWith(".pdf") && (f.toLowerCase().includes("cccd") || f.toLowerCase().includes("can_cuoc") || f.toLowerCase().includes("cmnd")));
        const pdfFiles = files.filter(f => f.toLowerCase().endsWith(".pdf"));
        const imgFiles = files.filter(f => (f.endsWith(".jpg") || f.endsWith(".png") || f.endsWith(".jpeg")) && !f.includes("_MS_"));
        const ghepFiles = files.filter(f => f.toLowerCase().includes("ghep"));

        if (cccdPdf.length > 0) tvkdStats[tvkd].hasCccdPdf++;
        else if (ghepFiles.length > 0) tvkdStats[tvkd].hasCccdGhep++;
        else if (imgFiles.length > 0) tvkdStats[tvkd].hasImages++;
        else if (pdfFiles.length > 0) tvkdStats[tvkd].hasPdfOnly++;

        if (tvkdStats[tvkd].samples.length < 3) {
          tvkdStats[tvkd].samples.push({
            code: c.maTKGD,
            batchDate: c.batchDate,
            name: c.hopDong?.hoVaTen || c.canCuoc?.hoVaTen || c.ms?.hoVaTen,
            files: files
          });
        }
      }

      console.log("=== THỐNG KÊ CHI TIẾT THEO TVKD (TỔNG:", cases.length, "CA) ===");
      for (const [tvkd, stat] of Object.entries(tvkdStats).sort((a,b) => b[1].total - a[1].total)) {
        console.log(\`TVKD \${tvkd}: \${stat.total} ca | CCCD-PDF: \${stat.hasCccdPdf} | PDF-Only (HĐ scan/PL): \${stat.hasPdfOnly} | CCCD-Ghép: \${stat.hasCccdGhep} | Có ảnh khác: \${stat.hasImages}\`);
        for (const s of stat.samples) {
          console.log(\`   - \${s.code} (\${s.name}): \${s.files.join(", ")}\`);
        }
      }

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
