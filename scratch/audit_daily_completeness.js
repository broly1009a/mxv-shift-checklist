const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

const msDir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026";
const tcMsDir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026";
const tcCqgDir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026";
const bkCqgDir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CQG/Futures/2026/T10.2026";
const tcAcmDir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/ACM/Futures/2026/T10.2026";
const bkAcmDir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026/T10.2026";

const allDays = new Set();
[msDir, tcMsDir, tcCqgDir, bkCqgDir, tcAcmDir, bkAcmDir].forEach(p => {
    if (fs.existsSync(p)) {
        fs.readdirSync(p).forEach(d => {
            if (/^\\d{2}\\.\\d{2}$/.test(d)) allDays.add(d);
        });
    }
});

const sortedDays = Array.from(allDays).sort();

console.log("NGÀY  | DSGD (MS) LOTS | FR (CQG RAW) LOTS | ACM (BROKER) LOTS | GHI CHÚ BẤT THƯỜNG");
console.log("------+----------------+-------------------+-------------------+-------------------");

let sumMsCqg = 0;
let sumRawCqg = 0;
let sumAcm = 0;

for (const d of sortedDays) {
    // 1. DSGD (MS)
    let msLot = 0;
    let msFile = null;
    for (const fld of [path.join(tcMsDir, d), path.join(msDir, d)]) {
        const fp = path.join(fld, 'DSGD.xlsx');
        if (fs.existsSync(fp)) {
            try {
                const wb = XLSX.readFile(fp);
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                let l = 0;
                rows.forEach(r => {
                    const acc = String(r['Mã TKGD'] || '').trim().toUpperCase();
                    if (!acc.endsWith('A')) l += Number(r['KL giao dịch'] || 0);
                });
                if (l > msLot) { msLot = l; msFile = fp; }
            } catch(e) {}
        }
    }
    
    // 2. FR (CQG Raw)
    let rawLot = 0;
    let rawFile = null;
    for (const fld of [path.join(tcCqgDir, d), path.join(bkCqgDir, d)]) {
        const fp = path.join(fld, 'FR.xlsx');
        if (fs.existsSync(fp)) {
            try {
                const wb = XLSX.readFile(fp);
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                let l = 0;
                rows.forEach(r => l += Number(r['Qty'] || r['Quantity'] || r['Volume'] || r['Lot'] || 0));
                if (l > rawLot) { rawLot = l; rawFile = fp; }
            } catch(e) {}
        }
    }
    
    // 3. ACM
    let acmLot = 0;
    for (const fld of [path.join(bkAcmDir, d), path.join(tcAcmDir, d)]) {
        if (!fs.existsSync(fld)) continue;
        for (const f of fs.readdirSync(fld)) {
            const fp = path.join(fld, f);
            if (!fs.statSync(fp).isFile()) continue;
            if ((f.startsWith('Fill') && (f.endsWith('.xls') || f.endsWith('.xlsx'))) || (f.startsWith('Straits') && f.endsWith('.csv'))) {
                try {
                    const wb = XLSX.readFile(fp);
                    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                    let l = 0;
                    rows.forEach(r => l += Number(r['Volume'] || r['Qty'] || r['Lot'] || 0));
                    if (l > acmLot) acmLot = l;
                } catch(e) {}
            }
        }
    }
    
    let note = '';
    if (msLot === 0 && rawLot > 0) note = '⚠️ DSGD BỊ THIẾU (CQG RAW CÓ ' + rawLot + ')';
    else if (rawLot === 0 && msLot > 0) note = '⚠️ THIẾU FR.xlsx';
    else if (msLot < 100 && rawLot > 1000) note = '⚠️ DSGD BỊ HỎNG/CỤT (CHỈ ' + msLot + ' LOT)';
    
    console.log(\`\${d} | \${String(msLot).padStart(14)} | \${String(rawLot).padStart(17)} | \${String(acmLot).padStart(17)} | \${note}\`);
    sumMsCqg += msLot;
    sumRawCqg += rawLot;
    sumAcm += acmLot;
}

console.log("------+----------------+-------------------+-------------------+-------------------");
console.log(\`TỔNG  | \${String(sumMsCqg).padStart(14)} | \${String(sumRawCqg).padStart(17)} | \${String(sumAcm).padStart(17)} |\`);
`;

  const cmd = `cat << 'EOF' > /tmp/audit_daily_completeness.js\n${remoteNode}\nEOF\nnode /tmp/audit_daily_completeness.js\nrm -f /tmp/audit_daily_completeness.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

