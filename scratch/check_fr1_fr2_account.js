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
      const frPath = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026/16.10/FR.xlsx";

      const targetDate = new Date("2026-10-16T14:45:18.161Z");
      const fr1 = fs.existsSync(fr1Path) ? cqgParser.parseFR(fs.readFileSync(fr1Path), targetDate) : [];
      const fr2 = fs.existsSync(fr2Path) ? cqgParser.parseFR(fs.readFileSync(fr2Path), targetDate) : [];
      const fr = fs.existsSync(frPath) ? cqgParser.parseFR(fs.readFileSync(frPath), targetDate) : [];

      console.log("FR1 total parsed:", fr1.length);
      console.log("FR2 total parsed:", fr2.length);
      console.log("FR total parsed:", fr.length);

      const inFr1 = fr1.filter(r => r.accountRaw === "043C0000112");
      const inFr2 = fr2.filter(r => r.accountRaw === "043C0000112");
      const inFr = fr.filter(r => r.accountRaw === "043C0000112");

      console.log("043C0000112 in FR1:", inFr1);
      console.log("043C0000112 in FR2:", inFr2);
      console.log("043C0000112 in FR:", inFr);
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
