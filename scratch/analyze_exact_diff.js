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
      
      const cqgParser = require("/opt/mxv-checklist/backend/dist/modules/trading-ops/parsers/cqg-excel.parser");
      const msParser = require("/opt/mxv-checklist/backend/dist/modules/trading-ops/parsers/ms-excel.parser");
      const { parseTradeDateTime, parseCqgDateTime } = require("/opt/mxv-checklist/backend/dist/modules/trading-ops/helpers/trading-math.helper");

      const dsgdBuf = fs.readFileSync("/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/16.10/DSGD.xlsx");
      const frBuf = fs.readFileSync("/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026/16.10/FR.xlsx");

      const tradingDate = new Date("2026-10-16T14:45:18.161Z");
      const rawDsgdData = msParser.parseDSGD(dsgdBuf);
      const rawFrData = cqgParser.parseFR(frBuf, tradingDate);

      const effectiveCutoffTime = new Date("2026-10-16T14:43:36.233Z");
      const effectiveCqgCutoffTime = new Date("2026-10-16T14:44:39.000Z");

      const sessionStart = new Date(tradingDate);
      sessionStart.setHours(5, 0, 0, 0);

      const checkTime = new Date(tradingDate);
      const dsgdUpperBound = checkTime;

      // Filter DSGD
      const dsgdData = rawDsgdData.filter(gd => {
        if (!gd.ngayGio) return true;
        const tradeTime = parseTradeDateTime(gd.ngayGio, tradingDate);
        if (!tradeTime) return true;
        if (effectiveCqgCutoffTime && !gd.maTKGD.toUpperCase().endsWith("A") && tradeTime > effectiveCqgCutoffTime) {
          return false;
        }
        return tradeTime <= dsgdUpperBound;
      });

      // Filter FR
      const frData = rawFrData.filter(fr => {
        if (!fr.time) return true;
        const tradeTime = parseCqgDateTime(fr.time, tradingDate);
        if (!tradeTime) return true;
        if (tradeTime < sessionStart) return false;
        if (effectiveCutoffTime && tradeTime > effectiveCutoffTime) {
          return false;
        }
        return tradeTime <= checkTime;
      });

      console.log("Filtered DSGD rows:", dsgdData.length);
      console.log("Filtered FR rows:", frData.length);

      let totalDSGD = 0;
      let totalFR = 0;
      const msGroup = {};
      const frGroup = {};

      dsgdData.forEach(gd => {
        if (!gd.maTKGD.toUpperCase().endsWith("A")) {
          totalDSGD += gd.klGiaoDich;
          msGroup[gd.combinedKey] = (msGroup[gd.combinedKey] || 0) + gd.klGiaoDich;
        }
      });

      frData.forEach(fr => {
        if (fr.symbol !== "ZWAZCE") {
          totalFR += fr.qty;
          frGroup[fr.combinedKey] = (frGroup[fr.combinedKey] || 0) + fr.qty;
        }
      });

      console.log("totalDSGD:", totalDSGD);
      console.log("totalFR:", totalFR);
      console.log("Differ:", totalFR - totalDSGD);

      // Check mismatchedTrades logic from service:
      const mismatches = [];
      frData.forEach(fr => {
        if (fr.symbol === "ZWAZCE") return;
        const exists = dsgdData.some(gd => gd.combinedKey === fr.combinedKey);
        if (!exists) mismatches.push(fr);
      });
      console.log("CQG not in MS count:", mismatches.length);

      const msMismatches = [];
      dsgdData.forEach(gd => {
        if (gd.maTKGD.toUpperCase().endsWith("A")) return;
        const exists = frData.some(fr => fr.combinedKey === gd.combinedKey);
        if (!exists) msMismatches.push(gd);
      });
      console.log("MS not in CQG count:", msMismatches.length);

      // Now check which keys have different quantities!
      const allKeys = Array.from(new Set([...Object.keys(msGroup), ...Object.keys(frGroup)]));
      const diffQtyKeys = [];
      allKeys.forEach(k => {
        const mq = msGroup[k] || 0;
        const fq = frGroup[k] || 0;
        if (mq !== fq) {
          diffQtyKeys.push({ key: k, msQty: mq, cqgQty: fq, diff: fq - mq });
        }
      });

      console.log("Keys with different quantities:", JSON.stringify(diffQtyKeys, null, 2));

      // Let us find the accounts for these diffQtyKeys
      diffQtyKeys.forEach(d => {
        const msRows = dsgdData.filter(g => g.combinedKey === d.key);
        const frRows = frData.filter(f => f.combinedKey === d.key);
        console.log("=== KEY:", d.key, "===");
        console.log("MS rows count:", msRows.length, msRows.map(r => ({ maLenh: r.maLenh, maTKGD: r.maTKGD, maHD: r.maHD, klGiaoDich: r.klGiaoDich, giaKhop: r.giaKhop, ngayGio: r.ngayGio })));
        console.log("CQG rows count:", frRows.length, frRows.map(r => ({ ord: r.ord, account: r.account, symbol: r.symbol, qty: r.qty, fillP: r.fillP, time: r.time })));
      });
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
