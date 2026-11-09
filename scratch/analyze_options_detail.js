const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
  const nodeCmd = `node -e '
    const XLSX = require("/opt/mxv-checklist/backend/node_modules/xlsx");
    const base = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026/30.10/";

    // Load DSTKGD-Futures to check account status
    const wbFut = XLSX.readFile(base + "DSTKGD-Futures.xlsx");
    const futRows = XLSX.utils.sheet_to_json(wbFut.Sheets[wbFut.SheetNames[0]]);
    const futStatusMap = new Map();
    for (const r of futRows) {
      const acc = String(r["Mã TKGD"] || "").trim();
      const st = String(r["Trạng thái"] || "").trim();
      futStatusMap.set(acc, st);
    }

    // Check DSTKGD-Options
    const wbOpt = XLSX.readFile(base + "DSTKGD-Options.xlsx");
    const optRows = XLSX.utils.sheet_to_json(wbOpt.Sheets[wbOpt.SheetNames[0]]);
    const optByTvkdAll = {};
    const optByTvkdActiveInFut = {};
    const opt045ByMonth = {};
    const opt045ActiveByMonth = {};

    for (const r of optRows) {
      const code = String(r["Mã TV"] || "").trim().padStart(3, "0");
      const acc = String(r["Mã TKGD"] || "").trim();
      const rawDate = r["Ngày đăng ký"];
      let monthYear = "";
      if (typeof rawDate === "number") {
        // Note: in Vietnamese Excel, DD/MM/YYYY was sometimes parsed by Excel as MM/DD/YYYY when day <= 12!
        const d = XLSX.SSF.parse_date_code(rawDate);
        // If Excel parsed DD/MM/YYYY as MM/DD/YYYY (so d.d is actually the month when d.y===2026 and d.m <= 12):
        monthYear = "SERIAL_" + String(d.d).padStart(2,"0") + "/" + String(d.m).padStart(2,"0") + "/" + d.y;
      } else {
        const regDate = String(rawDate || "").trim(); // DD/MM/YYYY
        monthYear = regDate.length >= 10 ? regDate.substring(3, 10) : regDate;
      }
      const st = futStatusMap.get(acc) || "UNKNOWN";

      optByTvkdAll[code] = (optByTvkdAll[code] || 0) + 1;
      if (st === "Hoạt động") {
        optByTvkdActiveInFut[code] = (optByTvkdActiveInFut[code] || 0) + 1;
      }
      if (code === "045") {
        opt045ByMonth[monthYear] = (opt045ByMonth[monthYear] || 0) + 1;
        if (st === "Hoạt động") {
          opt045ActiveByMonth[monthYear] = (opt045ActiveByMonth[monthYear] || 0) + 1;
        }
      }
    }
    console.log("Options All rows by TVKD:", optByTvkdAll);
    console.log("Options Active (in Futures) by TVKD:", optByTvkdActiveInFut);
    console.log("045 Options by reg month (All):", opt045ByMonth);
    console.log("045 Options by reg month (Active):", opt045ActiveByMonth);

    // Also check Spread & LME by status and joinDate
    for (const fname of ["DSTKGD-Spread.xlsx", "DSTKGD-LME.xlsx"]) {
      const wb = XLSX.readFile(base + fname);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      console.log("\\n=== Detail " + fname + " ===");
      const summary = {};
      for (const r of rows) {
        const code = String(r["Mã TVKD"] || "").trim().padStart(3, "0");
        const st = String(r["Trạng thái"] || "").trim();
        const joinDate = String(r["Ngày tham gia"] || "").trim();
        const my = joinDate.substring(3, 10);
        if (!summary[code]) summary[code] = { total: 0, statuses: {}, months: {} };
        summary[code].total++;
        summary[code].statuses[st] = (summary[code].statuses[st] || 0) + 1;
        summary[code].months[my] = (summary[code].months[my] || 0) + 1;
      }
      console.log(summary);
    }
  '`;
  conn.exec(nodeCmd, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d).stderr.on('data', d => console.error(d.toString())).on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

