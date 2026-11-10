const path = require('path');
const { Client } = require(path.resolve('backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
    const fs = require("fs");
    const XLSX = require("/opt/mxv-checklist/backend/node_modules/xlsx");
    const base = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026";
    const days = fs.readdirSync(base).filter(d => /^\\d{2}\\.\\d{2}$/.test(d)).sort();

    // Load account sets from DSTKGD-Spread, LME, Options
    function loadAccSet(file, col) {
      const wb = XLSX.readFile(base + "/30.10/" + file);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const s = new Set();
      for (const r of rows) {
        const a = String(r[col] || "").trim().toUpperCase();
        if (a) s.add(a);
      }
      return s;
    }
    const spreadAccs = loadAccSet("DSTKGD-Spread.xlsx", "Mã TKGD");
    const lmeAccs = loadAccSet("DSTKGD-LME.xlsx", "Mã TKGD");
    const optAccs = loadAccSet("DSTKGD-Options.xlsx", "Mã TKGD");
    console.log("Sample Spread Accs:", Array.from(spreadAccs).slice(0, 5));
    console.log("Sample LME Accs:", Array.from(lmeAccs).slice(0, 5));
    console.log("Sample Opt Accs:", Array.from(optAccs).slice(0, 5));

    const nonStdHd = new Set();
    const matchedSpread = {};
    const matchedLme = {};
    const matchedOpt = {};

    for (const d of days) {
      const p = base + "/" + d + "/DSGD.xlsx";
      if (!fs.existsSync(p)) continue;
      const wb = XLSX.readFile(p);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      for (const r of rows) {
        const acc = String(r["Mã TKGD"] || "").trim().toUpperCase();
        const hd = String(r["Mã HĐ"] || "").trim().toUpperCase();
        const lot = Number(r["KL giao dịch"]) || 0;
        const tvkd = String(r["Mã TVKD"] || "").trim().padStart(3, "0");
        if (acc.endsWith("-A")) continue;
        if (!/^[A-Z0-9]{2,4}[FGHJKMNQUVXZ]\\d{2}$/.test(hd)) {
          nonStdHd.add(hd + " (acc=" + acc + ", tvkd=" + tvkd + ", lot=" + lot + ")");
        }
        if (spreadAccs.has(acc) || acc.endsWith("S") || hd.includes("-")) {
          matchedSpread[tvkd + ":" + acc + ":" + hd] = (matchedSpread[tvkd + ":" + acc + ":" + hd] || 0) + lot;
        }
        if (lmeAccs.has(acc) || acc.endsWith("L")) {
          matchedLme[tvkd + ":" + acc + ":" + hd] = (matchedLme[tvkd + ":" + acc + ":" + hd] || 0) + lot;
        }
        if (optAccs.has(acc) || acc.endsWith("O")) {
          matchedOpt[tvkd + ":" + acc + ":" + hd] = (matchedOpt[tvkd + ":" + acc + ":" + hd] || 0) + lot;
        }
      }
    }
    console.log("Non-standard HD in T10 DSGD.xlsx (excl -A):", Array.from(nonStdHd));
    console.log("Matched Spread in T10:", matchedSpread);
    console.log("Matched LME in T10:", matchedLme);
    const t09Base = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T09.2026";
    if (fs.existsSync(t09Base)) {
      const t09NonStd = new Set();
      for (const d of fs.readdirSync(t09Base).filter(x => /^\\d{2}\\.\\d{2}$/.test(x)).sort()) {
        const p = t09Base + "/" + d + "/DSGD.xlsx";
        if (!fs.existsSync(p)) continue;
        const wb = XLSX.readFile(p);
        for (const r of XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])) {
          const acc = String(r["Mã TKGD"] || "").trim().toUpperCase();
          const hd = String(r["Mã HĐ"] || "").trim().toUpperCase();
          const lot = Number(r["KL giao dịch"]) || 0;
          if (acc.endsWith("-A")) continue;
          if (!/^[A-Z0-9]{2,4}[FGHJKMNQUVXZ]\\d{2}$/.test(hd)) {
            t09NonStd.add(d + ": " + hd + " (acc=" + acc + ", lot=" + lot + ")");
          }
        }
      }
      console.log("Non-standard HD in T09 DSGD.xlsx (excl -A):", Array.from(t09NonStd));
    }
  `;

  conn.exec('node -', (err, s) => {
    s.write(remoteScript);
    s.end();
    s.on('data', d => process.stdout.write(d));
    s.stderr.on('data', d => process.stderr.write(d));
    s.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
