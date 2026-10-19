let Client;
try {
  Client = require('ssh2').Client;
} catch (e) {
  try {
    Client = require('c:/Users/hiepth/OneDrive - MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/node_modules/ssh2').Client;
  } catch (e2) {
    Client = require('../mock-sftp/node_modules/ssh2').Client;
  }
}

const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `
    node -e '
      const path = require("path");
      const fs = require("fs");
      const XLSX = require("/opt/mxv-checklist/backend/node_modules/xlsx");

      const dsgdPath = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/16.10/DSGD.xlsx";
      const frPath = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026/16.10/FR.xlsx";

      console.log("DSGD exists:", fs.existsSync(dsgdPath));
      console.log("FR exists:", fs.existsSync(frPath));

      if (fs.existsSync(dsgdPath) && fs.existsSync(frPath)) {
        const wbDsgd = XLSX.readFile(dsgdPath);
        const sheetDsgd = wbDsgd.Sheets[wbDsgd.SheetNames[0]];
        const dsgdRows = XLSX.utils.sheet_to_json(sheetDsgd, { header: 1 });

        const wbFr = XLSX.readFile(frPath);
        const sheetFr = wbFr.Sheets[wbFr.SheetNames[0]];
        const frRows = XLSX.utils.sheet_to_json(sheetFr, { header: 1 });

        console.log("DSGD row count:", dsgdRows.length);
        console.log("FR row count:", frRows.length);

        // Find headers
        console.log("DSGD header:", dsgdRows[0]);
        console.log("FR header:", frRows[1] || frRows[0]);
      } else {
        // Find where 16.10 files are
        console.log("Searching for 16.10 files:");
        const { execSync } = require("child_process");
        try {
          console.log(execSync("find /mnt/qlgd-it -name \"*16.10*\" -type f 2>/dev/null | head -n 30").toString());
        } catch(e) {
          console.log(e.message);
        }
      }
    '
  `;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
