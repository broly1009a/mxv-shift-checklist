const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

const ms_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026";
const tc_acm_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/ACM/Futures/2026/T10.2026";
const bk_acm_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026/T10.2026";

const daysSet = new Set();
if (fs.existsSync(ms_dir)) fs.readdirSync(ms_dir).forEach(d => daysSet.add(d));
if (fs.existsSync(tc_acm_dir)) fs.readdirSync(tc_acm_dir).forEach(d => daysSet.add(d));
if (fs.existsSync(bk_acm_dir)) fs.readdirSync(bk_acm_dir).forEach(d => daysSet.add(d));

const days = Array.from(daysSet).filter(d => /^\\d{2}\\.\\d{2}$/.test(d)).sort();

const cqgMembers = {};
const acmMembers = {};
let totalCqg = 0;
let totalAcm = 0;

for (const d of days) {
    // 1. Doc DSGD cho CQG (và lay ACM neu ko co file ngoai)
    let dsgdAcmRows = [];
    const dsgdPath = path.join(ms_dir, d, 'DSGD.xlsx');
    if (fs.existsSync(dsgdPath)) {
        try {
            const wb = XLSX.readFile(dsgdPath);
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            for (const r of rows) {
                const acc = String(r['Mã TKGD'] || '').trim().toUpperCase();
                const lot = Number(r['KL giao dịch'] || 0);
                const member = acc.substring(0, 3);
                if (lot <= 0 || !member) continue;
                
                if (acc.endsWith('A')) {
                    dsgdAcmRows.push({ member, lot });
                } else {
                    cqgMembers[member] = (cqgMembers[member] || 0) + lot;
                    totalCqg += lot;
                }
            }
        } catch(e) {}
    }
    
    // 2. Doc file ACM ngoai
    let bestFile = null;
    let bestSize = 0;
    for (const folder of [path.join(bk_acm_dir, d), path.join(tc_acm_dir, d)]) {
        if (!fs.existsSync(folder)) continue;
        fs.readdirSync(folder).forEach(f => {
            const fp = path.join(folder, f);
            const st = fs.statSync(fp);
            if (st.isFile() && (f.startsWith('Fill') || f.startsWith('Straits')) && (f.endsWith('.xls') || f.endsWith('.xlsx') || f.endsWith('.csv'))) {
                if (st.size > bestSize) {
                    bestSize = st.size;
                    bestFile = fp;
                }
            }
        });
    }
    
    let dayAcmLot = 0;
    if (bestFile && bestSize > 1000) {
        try {
            const wb = XLSX.readFile(bestFile);
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            for (const r of rows) {
                const m = String(r['Trading Firm Id'] || r['Firm'] || r['Member'] || r['Account'] || '').trim().substring(0, 3);
                const lot = Number(r['Volume'] || r['Qty'] || r['Lot'] || 0);
                if (lot > 0 && m) {
                    acmMembers[m] = (acmMembers[m] || 0) + lot;
                    dayAcmLot += lot;
                    totalAcm += lot;
                }
            }
        } catch(e) {}
    } else if (dsgdAcmRows.length > 0) {
        // Fallback ve DSGD neu khong co file broker
        for (const item of dsgdAcmRows) {
            acmMembers[item.member] = (acmMembers[item.member] || 0) + item.lot;
            dayAcmLot += item.lot;
            totalAcm += item.lot;
        }
    }
}

console.log("=== SIMULATED FIX RESULTS FOR MONTH 10 ===");
console.log(\`Tổng CQG: \${totalCqg.toLocaleString()} lots\`);
console.log(\`Tổng ACM: \${totalAcm.toLocaleString()} lots\`);
console.log(\`Tổng Toàn Thị Trường: \${(totalCqg + totalAcm).toLocaleString()} lots\`);
console.log("\\nTop 5 TVKD CQG:");
Object.entries(cqgMembers).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([m,v])=>console.log(\`  \${m}: \${v.toLocaleString()} lots\`));
console.log("\\nTop 5 TVKD ACM:");
Object.entries(acmMembers).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([m,v])=>console.log(\`  \${m}: \${v.toLocaleString()} lots\`));
`;

  const cmd = `cat << 'EOF' > /tmp/sim_fix.js\n${remoteNode}\nEOF\nnode /tmp/sim_fix.js\nrm -f /tmp/sim_fix.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

