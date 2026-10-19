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
    cd /opt/mxv-checklist/backend && node -e '
      const fs = require("fs");
      const cqgParser = require("/opt/mxv-checklist/backend/dist/modules/trading-ops/parsers/cqg-excel.parser");

      const fr1Path = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026/16.10/FR1.xlsx";
      const fr2Path = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026/16.10/FR2.xlsx";

      const targetDate = new Date("2026-10-16T14:45:18.161Z");
      const fr1 = cqgParser.parseFR(fs.readFileSync(fr1Path), targetDate);
      const fr2 = cqgParser.parseFR(fs.readFileSync(fr2Path), targetDate);

      // Check duplicates between FR1 and FR2 by ord or account+symbol+time
      const duplicates = [];
      fr1.forEach(r1 => {
        const match = fr2.find(r2 => r2.ord === r1.ord && r2.accountRaw === r1.accountRaw && r2.symbol === r1.symbol && r2.time === r1.time);
        if (match) {
          duplicates.push({ r1, match });
        }
      });

      console.log("Total duplicate orders between FR1 and FR2:", duplicates.length);
      console.log("Duplicate orders details:", JSON.stringify(duplicates, null, 2));

      // Also check if any other accounts overlap between FR1 and FR2
      const acc1 = new Set(fr1.map(r => r.accountRaw));
      const acc2 = new Set(fr2.map(r => r.accountRaw));
      const overlapAccs = [...acc1].filter(a => acc2.has(a));
      console.log("Accounts appearing in both FR1 and FR2:", overlapAccs);
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
