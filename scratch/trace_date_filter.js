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
      const path = require("path");
      const { parseDSGD, parseFR, parseTradeDateTime, parseCqgDateTime } = require("/opt/mxv-checklist/backend/dist/modules/reconciliation/helpers/recon-number-parser.helper.js");

      const msFile = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T09.2026/30.09/DSGD.xlsx";
      const cqgFile = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CQG/Futures/2026/T09.2026/30.09/FR.xlsx";

      const dsgdBuf = fs.readFileSync(msFile);
      const frBuf = fs.readFileSync(cqgFile);

      // What was the checkTime in that job?
      // In the job log: [2026-09-30T02:36:24.261Z] Khoảng thời gian lọc: từ 05:00:00 30/9/2026 đến 05:00:00 1/10/2026
      // Notice: targetDate was passed as Date(2026-09-30) without hours!
      console.log("=== CHECK DATE TIME BOUNDS ===");
      const dateWithoutHours = new Date("2026-09-30T00:00:00.000Z");
      console.log("dateWithoutHours:", dateWithoutHours.toISOString());
      console.log("getHours():", dateWithoutHours.getHours(), "getUTCHours():", dateWithoutHours.getUTCHours());

      // Trace checkKLGD logic:
      const rawDsgdData = parseDSGD(dsgdBuf);
      const rawFrData = parseFR(frBuf, dateWithoutHours, []);

      const sessionStartStr = "05:00";
      const sessionStart = new Date(dateWithoutHours);
      const [sHour, sMin] = sessionStartStr.split(":").map(Number);

      const isPastDateOrDateOnly =
        (dateWithoutHours.getHours() === 0 &&
          dateWithoutHours.getMinutes() === 0 &&
          dateWithoutHours.getSeconds() === 0) ||
        (dateWithoutHours.getUTCHours() === 0 &&
          dateWithoutHours.getUTCMinutes() === 0 &&
          dateWithoutHours.getUTCSeconds() === 0);

      console.log("isPastDateOrDateOnly:", isPastDateOrDateOnly);

      let checkTime;
      if (isPastDateOrDateOnly) {
        sessionStart.setHours(sHour, sMin, 0, 0);
        checkTime = new Date(sessionStart);
        checkTime.setDate(checkTime.getDate() + 1);
      } else {
        checkTime = new Date(dateWithoutHours);
      }
      console.log("sessionStart:", sessionStart.toISOString());
      console.log("checkTime:", checkTime.toISOString());

      // NOW CHECK dsgdCutoffTime from file mtime!
      const stat = fs.statSync(msFile);
      console.log("msFile mtime:", stat.mtime.toISOString(), "(Local:", stat.mtime.toLocaleString("vi-VN"), ")");
      const dsgdCutoffTime = new Date(stat.mtime.getTime() - 2000);
      console.log("dsgdCutoffTime:", dsgdCutoffTime.toISOString());

      // Now test filter on rawDsgdData and rawFrData:
      const dsgdItem = rawDsgdData.find(d => d.maLenh === "115612129");
      const frItem = rawFrData.find(f => f.ord === "115612129");

      console.log("dsgdItem raw date:", dsgdItem.ngayGio);
      const dsgdTradeTime = parseTradeDateTime(dsgdItem.ngayGio, dateWithoutHours);
      console.log("dsgdTradeTime:", dsgdTradeTime ? dsgdTradeTime.toISOString() : null);

      console.log("frItem raw time:", frItem.time);
      const frTradeTime = parseCqgDateTime(frItem.time, dateWithoutHours);
      console.log("frTradeTime:", frTradeTime ? frTradeTime.toISOString() : null);

      console.log("dsgdTradeTime <= checkTime?", dsgdTradeTime <= checkTime);
      console.log("frTradeTime < sessionStart?", frTradeTime < sessionStart);
      console.log("frTradeTime > dsgdCutoffTime?", frTradeTime > dsgdCutoffTime);
      console.log("frTradeTime <= checkTime?", frTradeTime <= checkTime);
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
