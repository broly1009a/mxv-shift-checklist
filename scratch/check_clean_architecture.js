const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

console.log("================================================================================");
console.log("       KIỂM THỬ DEDUPLICATION TRADE ID + BROKER ACM ĐỘC LẬP                    ");
console.log("================================================================================");

const msBase = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026";
const bkAcmBase = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026/T10.2026";
const tcAcmBase = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/ACM/Futures/2026/T10.2026";
const tcCqgBase = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026";

// 1. TÍNH CQG CÓ DEDUPLICATE THEO MÃ GIAO DỊCH
const seenCqgTradeIds = new Set();
let uniqueCqgLots = 0;
const cqgMemberLots = {};
let duplicateCount = 0;

const days = fs.readdirSync(msBase).filter(d => /^\\d{2}\\.\\d{2}$/.test(d)).sort();

for (const d of days) {
    let dsgdPath = path.join(msBase, d, 'DSGD.xlsx');
    if (!fs.existsSync(dsgdPath) && fs.existsSync(tcCqgBase)) {
        dsgdPath = path.join(tcCqgBase, d, 'DSGD.xlsx');
    }
    if (!fs.existsSync(dsgdPath)) continue;
    
    const wb = XLSX.readFile(dsgdPath);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    
    for (const r of rows) {
        const acc = String(r['Mã TKGD'] || '').trim().toUpperCase();
        if (acc.endsWith('A')) continue; // Loai bo ACM Nano!
        
        const tradeId = String(r['Mã giao dịch'] || r['Mã lệnh'] || '').trim();
        const lot = Number(r['KL giao dịch'] || 0);
        if (lot <= 0 || !acc) continue;
        
        // Key deduplicate: tradeId (hoặc tradeId + acc nếu tradeId rỗng)
        const dedupKey = tradeId ? tradeId : \`\${acc}_\${r['Mã HĐ']}_\${r['Ngày giờ thực hiện']}_\${lot}\`;
        
        if (seenCqgTradeIds.has(dedupKey)) {
            duplicateCount++;
            continue;
        }
        seenCqgTradeIds.add(dedupKey);
        
        const tvkd = acc.substring(0, 3);
        cqgMemberLots[tvkd] = (cqgMemberLots[tvkd] || 0) + lot;
        uniqueCqgLots += lot;
    }
}

// 2. TÍNH ACM ĐỘC LẬP TỪ BROKER (ZERO FALLBACK)
const seenAcmTradeIds = new Set();
let totalAcmVolume = 0;
const acmMemberLots = {};

const acmDaysSet = new Set();
[bkAcmBase, tcAcmBase].forEach(p => {
    if (fs.existsSync(p)) {
        fs.readdirSync(p).forEach(d => {
            if (/^\\d{2}\\.\\d{2}$/.test(d)) acmDaysSet.add(d);
        });
    }
});
const sortedAcmDays = Array.from(acmDaysSet).sort();

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
    
    if (chosenFile && chosenSize > 1000) {
        try {
            const wb = XLSX.readFile(chosenFile);
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            for (const r of rows) {
                const tvkd = String(r['Trading Firm Id'] || r['Firm'] || r['Member'] || r['Account'] || '').trim().substring(0, 3);
                const lot = Number(r['Volume'] || r['Qty'] || r['Lot'] || 0);
                if (lot > 0 && tvkd) {
                    totalAcmVolume += lot;
                    acmMemberLots[tvkd] = (acmMemberLots[tvkd] || 0) + lot;
                }
            }
        } catch(e) {}
    }
}

console.log(\`[KẾT QUẢ DEDUPLICATE CHUẨN XÁC THÁNG 10/2026]:\`);
console.log(\`  - Tổng lệnh CQG bị trùng lặp giữa các thư mục: \${duplicateCount.toLocaleString()} lệnh\`);
console.log(\`  - Khối lượng CQG thực tế (Unique Trades): \${uniqueCqgLots.toLocaleString()} lots\`);
console.log(\`  - Khối lượng ACM thực tế (Broker 100% - Zero Fallback): \${totalAcmVolume.toLocaleString()} lots\`);
console.log(\`  - TỔNG TOÀN THỊ TRƯỜNG THỰC TẾ: \${(uniqueCqgLots + totalAcmVolume).toLocaleString()} lots\`);
console.log(\`  - Tỷ trọng ACM: \${((totalAcmVolume/(uniqueCqgLots + totalAcmVolume))*100).toFixed(2)}%\`);

console.log("\\nTOP 5 TVKD CQG:");
Object.entries(cqgMemberLots).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([m,v], idx) => {
    console.log(\`  \${idx+1}. TVKD \${m}: \${v.toLocaleString()} lots (\${((v/uniqueCqgLots)*100).toFixed(2)}%)\`);
});

console.log("\\nTOP 5 TVKD ACM:");
Object.entries(acmMemberLots).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([m,v], idx) => {
    console.log(\`  \${idx+1}. TVKD \${m}: \${v.toLocaleString()} lots (\${((v/totalAcmVolume)*100).toFixed(2)}%)\`);
});
`;

  const cmd = `cat << 'EOF' > /tmp/check_clean_arch.js\n${remoteNode}\nEOF\nnode /tmp/check_clean_arch.js\nrm -f /tmp/check_clean_arch.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

