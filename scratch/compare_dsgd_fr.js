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
      
      // Load parsers from compiled or dist or ts-node
      // Let us check what klgd-recon.service did
      // We can directly require from dist
      let klgdService, parseDSGD, parseFR;
      try {
        const cqgParser = require("/opt/mxv-checklist/backend/dist/modules/trading-ops/parsers/cqg-excel.parser");
        const msParser = require("/opt/mxv-checklist/backend/dist/modules/trading-ops/parsers/ms-excel.parser");
        parseFR = cqgParser.parseFR;
        parseDSGD = msParser.parseDSGD;
      } catch (err) {
        console.error("Require dist error:", err.message);
      }

      if (parseFR && parseDSGD) {
        const dsgdBuf = fs.readFileSync("/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/16.10/DSGD.xlsx");
        const frBuf = fs.readFileSync("/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026/16.10/FR.xlsx");

        const targetDate = new Date("2026-10-16T14:45:18.161Z");
        const dsgdData = parseDSGD(dsgdBuf);
        const frData = parseFR(frBuf, targetDate);

        console.log("Parsed DSGD records:", dsgdData.length);
        console.log("Parsed FR records:", frData.length);

        let totalDSGD = 0;
        let totalACM = 0;
        let totalFR = 0;

        const msByKey = {};
        const cqgByKey = {};

        dsgdData.forEach(gd => {
          if (gd.maTKGD.toUpperCase().endsWith("A")) {
            totalACM += gd.klGiaoDich;
          } else {
            totalDSGD += gd.klGiaoDich;
            msByKey[gd.combinedKey] = (msByKey[gd.combinedKey] || 0) + gd.klGiaoDich;
          }
        });

        frData.forEach(fr => {
          if (fr.symbol !== "ZWAZCE") {
            totalFR += fr.qty;
            cqgByKey[fr.combinedKey] = (cqgByKey[fr.combinedKey] || 0) + fr.qty;
          }
        });

        console.log("totalDSGD (non-A):", totalDSGD);
        console.log("totalACM (ends with A):", totalACM);
        console.log("totalFR:", totalFR);
        console.log("diff:", totalFR - totalDSGD);

        // Check if there are keys in CQG with different total quantity than MS!
        const allKeys = Array.from(new Set([...Object.keys(msByKey), ...Object.keys(cqgByKey)]));
        const diffKeys = [];
        allKeys.forEach(k => {
          const msqty = msByKey[k] || 0;
          const cqgqty = cqgByKey[k] || 0;
          if (msqty !== cqgqty) {
            diffKeys.push({ key: k, msQty: msqty, cqgQty: cqgqty, diff: cqgqty - msqty });
          }
        });

        console.log("Number of keys with qty mismatch:", diffKeys.length);
        console.log("Differences (top 20):", JSON.stringify(diffKeys.slice(0, 20), null, 2));

        // Also check if any FR account ends with A!
        const frEndsWithA = frData.filter(fr => fr.accountRaw.toUpperCase().endsWith("A"));
        console.log("FR records ending with A:", frEndsWithA.length);
        if (frEndsWithA.length > 0) {
          console.log("FR ending with A details:", frEndsWithA);
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
