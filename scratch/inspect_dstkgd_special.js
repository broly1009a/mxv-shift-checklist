const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
  const nodeCmd = `node -e '
    const XLSX = require("/opt/mxv-checklist/backend/node_modules/xlsx");
    for (const fname of ["DSTKGD-Spread.xlsx", "DSTKGD-LME.xlsx", "DSTKGD-Options.xlsx"]) {
      const p = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026/30.10/" + fname;
      const wb = XLSX.readFile(p);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      console.log("=== " + fname + " (total rows: " + rows.length + ") ===");
      if (rows.length > 0) {
        console.log("Columns:", Object.keys(rows[0]));
        console.log("Sample row 0:", rows[0]);
        console.log("Sample row 1:", rows[1]);
        // Group by Trạng thái
        const statusCount = {};
        for (const r of rows) {
          const st = r["Trạng thái"] || r["Trang thai"] || "UNKNOWN";
          statusCount[st] = (statusCount[st] || 0) + 1;
        }
        console.log("By Status:", statusCount);
      }
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

