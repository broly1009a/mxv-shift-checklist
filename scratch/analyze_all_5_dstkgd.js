const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
  const nodeCmd = `node -e '
    const fs = require("fs");
    const XLSX = require("/opt/mxv-checklist/backend/node_modules/xlsx");
    const futBase = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026/30.10/";
    const acmBase = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/ACM/2026/T10.2026/30.10/";

    console.log("Files in Futures 30.10:", fs.existsSync(futBase) ? fs.readdirSync(futBase) : "NOT FOUND");
    console.log("Files in ACM 30.10:", fs.existsSync(acmBase) ? fs.readdirSync(acmBase) : "NOT FOUND");

    function inspectFile(filePath, label) {
      if (!fs.existsSync(filePath)) {
        console.log(label + ": FILE NOT FOUND (" + filePath + ")");
        return;
      }
      const wb = XLSX.readFile(filePath);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      console.log("\\n=== " + label + " (rows=" + rows.length + ") ===");
      if (rows.length > 0) {
        console.log("Columns:", Object.keys(rows[0]));
      }
      const allTvkd = new Set();
      const activeTvkd = new Set();
      const statusCounts = {};
      for (const r of rows) {
        const code = String(r["Mã TVKD"] || r["Mã TV"] || r["Mã thành viên"] || "").trim().padStart(3, "0");
        if (!code || code === "999") continue;
        const rawSt = r["Trạng thái"];
        const st = rawSt === undefined ? "(EMPTY)" : String(rawSt).trim();
        statusCounts[st] = (statusCounts[st] || 0) + 1;
        allTvkd.add(code);
        if (st === "Hoạt động" || st === "(EMPTY)") {
          activeTvkd.add(code);
        }
      }
      console.log("Status counts:", statusCounts);
      console.log("All TVKD count (" + allTvkd.size + "):", Array.from(allTvkd).sort().join(", "));
      console.log("Active TVKD count (" + activeTvkd.size + "):", Array.from(activeTvkd).sort().join(", "));
    }

    inspectFile(futBase + "DSTKGD-Futures.xlsx", "DSTKGD-Futures.xlsx");
    inspectFile(futBase + "DSTKGD-Spread.xlsx", "DSTKGD-Spread.xlsx");
    inspectFile(futBase + "DSTKGD-LME.xlsx", "DSTKGD-LME.xlsx");
    inspectFile(futBase + "DSTKGD-Options.xlsx", "DSTKGD-Options.xlsx");
    inspectFile(futBase + "DSTKGD-ACM.xlsx", "Futures/DSTKGD-ACM.xlsx");
    const wbAcm = XLSX.readFile(futBase + "DSTKGD-ACM.xlsx");
    const rowsAcm = XLSX.utils.sheet_to_json(wbAcm.Sheets[wbAcm.SheetNames[0]]);
    const acmByCode = {};
    for (const r of rowsAcm) {
      const code = String(r["Mã TVKD"] || "").trim().padStart(3, "0");
      const st = String(r["Trạng thái"] || "").trim();
      const jd = String(r["Ngày tham gia"] || "").trim();
      const my = jd.length >= 10 ? jd.substring(3, 10) : jd;
      if (!acmByCode[code]) acmByCode[code] = { total: 0, active: 0, months: {} };
      acmByCode[code].total++;
      if (st === "Hoạt động") acmByCode[code].active++;
      acmByCode[code].months[my] = (acmByCode[code].months[my] || 0) + 1;
    }
    console.log("ACM detail for 043, 046, 059, 062, 069, 070, 071, 072, 086, 088:");
    for (const c of ["043", "046", "059", "062", "069", "070", "071", "072", "086", "088"]) {
      console.log("  " + c + ":", JSON.stringify(acmByCode[c]));
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
