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
        "ketLuan.danhSachLoi": { $elemMatch: { $regex: "PHÁT HIỆN CCCD BẤT THƯỜNG", $options: "i" } }
      }).toArray();

      console.log("TỔNG SỐ CA THỰC SỰ CÓ CẢNH BÁO BCA BẤT THƯỜNG:", cases.length);

      const category = {
        invalidProvince: [],
        mismatchDobCentury: [],
        mismatchDobYear: [],
        futureIssueDate: [],
        mrzFake: [],
        other: []
      };

      for (const c of cases) {
        const bcaErrors = (c.ketLuan?.danhSachLoi || []).filter(e => e.includes("[PHÁT HIỆN CCCD BẤT THƯỜNG]"));
        const item = {
          code: c.maTKGD,
          name: c.hopDong?.hoVaTen || c.canCuoc?.hoVaTen || c.ms?.hoVaTen,
          errors: bcaErrors,
          cccd: c.canCuoc?.soCCCD || c.hopDong?.soCanCuoc || c.ms?.soCMND_HoChieu,
          msCccd: c.ms?.soCMND_HoChieu,
          dob: c.canCuoc?.rawNgaySinh || c.hopDong?.rawNgaySinh || c.ms?.rawNgaySinh,
          msDob: c.ms?.rawNgaySinh,
          issue: c.canCuoc?.rawNgayCap || c.canCuoc?.ngayCap || c.ms?.rawNgayCap,
          msIssue: c.ms?.rawNgayCap
        };

        let matched = false;
        if (bcaErrors.some(e => e.includes("Mã tỉnh"))) {
          category.invalidProvince.push(item);
          matched = true;
        }
        if (bcaErrors.some(e => e.includes("thế kỷ"))) {
          category.mismatchDobCentury.push(item);
          matched = true;
        }
        if (bcaErrors.some(e => e.includes("năm sinh trên thẻ") || e.includes("Năm sinh"))) {
          category.mismatchDobYear.push(item);
          matched = true;
        }
        if (bcaErrors.some(e => e.includes("tương lai"))) {
          category.futureIssueDate.push(item);
          matched = true;
        }
        if (bcaErrors.some(e => e.includes("MRZ"))) {
          category.mrzFake.push(item);
          matched = true;
        }
        if (!matched) category.other.push(item);
      }

      console.log("\\nPHÂN BỐ THEO TỪNG NHÓM QUY CHUẨN BCA:");
      console.log("1. Mã tỉnh không tồn tại:", category.invalidProvince.length, "ca");
      console.log("2. Năm sinh không khớp thế kỷ mã hóa:", category.mismatchDobCentury.length, "ca");
      console.log("3. 2 số năm sinh trên thẻ không khớp Ngày sinh:", category.mismatchDobYear.length, "ca");
      console.log("4. Ngày cấp ở tương lai:", category.futureIssueDate.length, "ca");
      console.log("5. Dải MRZ bất thường / phôi giả:", category.mrzFake.length, "ca");
      console.log("6. Khác:", category.other.length, "ca");

      console.log("\\n=== VÍ DỤ 1: MÃ TỈNH KHÔNG TỒN TẠI ===");
      category.invalidProvince.slice(0, 3).forEach(x => console.log(JSON.stringify(x, null, 2)));

      console.log("\\n=== VÍ DỤ 2: THẾ KỶ & NĂM SINH KHÔNG KHỚP ===");
      category.mismatchDobCentury.slice(0, 3).forEach(x => console.log(JSON.stringify(x, null, 2)));

      console.log("\\n=== VÍ DỤ 3: 2 SỐ NĂM SINH TRÊN THẺ LỆCH NGÀY SINH ===");
      category.mismatchDobYear.slice(0, 3).forEach(x => console.log(JSON.stringify(x, null, 2)));

      console.log("\\n=== VÍ DỤ 4: NGÀY CẤP Ở TƯƠNG LAI ===");
      category.futureIssueDate.slice(0, 3).forEach(x => console.log(JSON.stringify(x, null, 2)));

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
