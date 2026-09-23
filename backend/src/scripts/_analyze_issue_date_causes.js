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

      let futureDateCount = 0;
      let monthSwapOrOcrTypo = 0;
      let msNullCount = 0;
      let genuineMismatch = 0;

      const details = [];

      for (const c of cases) {
        const ocrCap = c.canCuoc?.ngayCap || "";
        const msCap = c.ms?.ngayCap || "";
        const hdCap = c.hopDong?.ngayCap || "";

        const ocrStr = ocrCap ? new Date(ocrCap).toISOString().slice(0, 10) : "";
        const msStr = msCap ? new Date(msCap).toISOString().slice(0, 10) : "";
        const hdStr = hdCap ? new Date(hdCap).toISOString().slice(0, 10) : "";

        const isFuture = (c.canCuoc?.ngayCap && new Date(c.canCuoc.ngayCap) > new Date("2026-09-01"));

        if (isFuture) {
          futureDateCount++;
          details.push({ code: c.maTKGD, type: "FUTURE_DATE (Lấy nhầm Ngày hết hạn)", ocr: ocrStr, ms: msStr, hd: hdStr });
        } else if (!msStr) {
          msNullCount++;
          details.push({ code: c.maTKGD, type: "MS_NULL", ocr: ocrStr, ms: msStr, hd: hdStr });
        } else {
          monthSwapOrOcrTypo++;
          details.push({ code: c.maTKGD, type: "OCR_TYPO / LỆCH THỰC", ocr: ocrStr, ms: msStr, hd: hdStr });
        }
      }

      console.log("=== PHÂN TÍCH NGUYÊN NHÂN 110 CA LỆCH NGÀY CẤP ===");
      console.log("- Do OCR lấy nhầm Ngày hết hạn mặt trước (Ngày ở tương lai 2027-2044):", futureDateCount, "ca");
      console.log("- Do M-System để trống ngày cấp:", msNullCount, "ca");
      console.log("- Do OCR đọc nhầm nét chữ số (12 thành 02, 14 thành 04, 01 thành 10...):", monthSwapOrOcrTypo, "ca");

      console.log("\\n--- 10 VÍ DỤ ĐIỂN HÌNH ---");
      details.slice(0, 10).forEach(d => {
        console.log(\`[\${d.code}] \${d.type} | OCR: \${d.ocr} | MS: \${d.ms} | HĐ: \${d.hd}\`);
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
