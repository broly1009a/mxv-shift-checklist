const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
  const nodeCmd = `node -e '
    const XLSX = require("/opt/mxv-checklist/backend/node_modules/xlsx");
    
    // Check DSTKGD-Spread.xlsx on 30.10
    for (const fname of ["DSTKGD-Spread.xlsx", "DSTKGD-LME.xlsx", "DSTKGD-Options.xlsx"]) {
      const p = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026/30.10/" + fname;
      const wb = XLSX.readFile(p);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      console.log("\\n=== " + fname + " ===");
      const byTvkdAll = {};
      const byTvkdActive = {};
      const byTvkdOct = {};
      const byTvkdSep = {};
      for (const r of rows) {
        const code = String(r["Mã TVKD"] || r["Mã TV"] || "").trim().padStart(3, "0");
        const st = String(r["Trạng thái"] || "").trim();
        const joinDate = String(r["Ngày đăng ký"] || r["Ngày tham gia"] || "").trim();
        byTvkdAll[code] = (byTvkdAll[code] || 0) + 1;
        if (st === "Hoạt động" || !r["Trạng thái"]) {
          byTvkdActive[code] = (byTvkdActive[code] || 0) + 1;
          if (joinDate.includes("/10/2026") || joinDate.includes("/10/2025")) {
            byTvkdOct[code] = (byTvkdOct[code] || 0) + 1;
          }
          if (joinDate.includes("/09/2026") || joinDate.includes("/09/2025")) {
            byTvkdSep[code] = (byTvkdSep[code] || 0) + 1;
          }
        }
      }
      console.log("Active by TVKD:", byTvkdActive);
      console.log("Total Active sum:", Object.values(byTvkdActive).reduce((a, b) => a + b, 0));
      console.log("All rows by TVKD:", byTvkdAll);
      console.log("Joined in 09:", byTvkdSep);
      console.log("Joined in 10:", byTvkdOct);
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

