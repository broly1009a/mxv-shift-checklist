const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

console.log("================================================================================");
console.log("       KIỂM THỬ KIẾN TRÚC CHUẨN ĐỘC LẬP NGUỒN (ZERO-FALLBACK ARCHITECTURE)     ");
console.log("       - CQG: Độc quyền từ DSGD.xlsx (lọc !acc.endsWith('A'))                  ");
console.log("       - ACM: Độc quyền từ Broker ACM (Fill.xls/Fill.xlsx/Straits.csv)        ");
console.log("================================================================================");

const msBase = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026";
const bkAcmBase = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026/T10.2026";
const tcAcmBase = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/ACM/Futures/2026/T10.2026";
const tcCqgBase = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026";

// 1. TÍNH ACM ĐỘC LẬP TỪ BROKER ACM
const acmDaysSet = new Set();
[bkAcmBase, tcAcmBase].forEach(p => {
    if (fs.existsSync(p)) {
        fs.readdirSync(p).forEach(d => {
            if (/^\\d{2}\\.\\d{2}$/.test(d)) acmDaysSet.add(d);
        });
    }
});
const sortedAcmDays = Array.from(acmDaysSet).sort();

let totalAcmVolume = 0;
const acmMemberVolume = {};
const acmDailyAudit = [];

for (const d of sortedAcmDays) {
    let chosenFile = null;
    let chosenSize = 0;
    
    for (const fld of [path.join(bkAcmBase, d), path.join(tcAcmBase, d)]) {
        if (!fs.existsSync(fld)) continue;
        for (const f of fs.readdirSync(fld)) {
            const fp = path.join(fld, f);
            const st = fs.statSync(fp);
            if (!st.isFile()) continue;
            if ((f.startsWith('Fill') && (f.endsWith('.xls') || f.endsWith('.xlsx'))) || (f.startsWith('Straits') && f.endsWith('.csv'))) {
                if (st.size > chosenSize) {
                    chosenSize = st.size;
                    chosenFile = fp;
                }
            }
        }
    }
    
    let dayLot = 0;
    let rowsCount = 0;
    if (chosenFile && chosenSize > 1000) {
        try {
            const wb = XLSX.readFile(chosenFile);
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            rowsCount = rows.length;
            for (const r of rows) {
                const m = String(r['Trading Firm Id'] || r['Firm'] || r['Member'] || r['Account'] || '').trim().substring(0, 3);
                const lot = Number(r['Volume'] || r['Qty'] || r['Lot'] || 0);
                if (lot > 0 && m) {
                    dayLot += lot;
                    totalAcmVolume += lot;
                    acmMemberVolume[m] = (acmMemberVolume[m] || 0) + lot;
                }
            }
        } catch(e) {}
    }
    acmDailyAudit.push({ day: d, file: chosenFile ? path.basename(chosenFile) : 'NONE', size: chosenSize, lots: dayLot, rows: rowsCount });
}

console.log(\`\\n[ACM BROKER REPORT] Tìm thấy \${sortedAcmDays.length} ngày giao dịch của Broker ACM:\`);
console.log("NGÀY  | FILE CHỌN               | KÍCH THƯỚC | SỐ DÒNG | SỐ LOT ACM");
console.log("------+-------------------------+------------+---------+-----------");
acmDailyAudit.forEach(r => {
    console.log(\`\${r.day} | \${r.file.padEnd(23)} | \${String((r.size/1024).toFixed(1) + ' KB').padStart(10)} | \${String(r.rows).padStart(7)} | \${String(r.lots).padStart(9)}\`);
});

console.log("------------------------------------------------------------------");
console.log(\`TỔNG KHỐI LƯỢNG ACM THỰC TẾ: \${totalAcmVolume.toLocaleString()} lots\`);
console.log("\\nTop 5 TVKD ACM (CHUẨN 100% TỪ BROKER):");
Object.entries(acmMemberVolume).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([m,v], idx) => {
    console.log(\`  \${idx+1}. TVKD \${m}: \${v.toLocaleString()} lots (\${((v/totalAcmVolume)*100).toFixed(2)}%)\`);
});
`;

  const cmd = `cat << 'EOF' > /tmp/check_pure_acm.js\n${remoteNode}\nEOF\nnode /tmp/check_pure_acm.js\nrm -f /tmp/check_pure_acm.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

