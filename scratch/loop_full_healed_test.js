const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

console.log("================================================================================");
console.log("       FULL LOOP ENGINEERING TEST WITH HEALING & DEDUPLICATION                 ");
console.log("================================================================================");

const tcPath = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck";
const bkPath = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong";

function runMonthLoop(year, month) {
    const monthStr = String(month).padStart(2, '0');
    const folderKey = \`\${year}/T\${monthStr}.\${year}\`;
    
    const msFolder1 = path.join(tcPath, 'Futures', folderKey);
    const msFolder2 = path.join(bkPath, 'Backup MS/Futures', folderKey);
    
    const cqgRawFolder1 = path.join(tcPath, 'Futures/CQG', folderKey);
    const cqgRawFolder2 = path.join(bkPath, 'Backup CQG/Futures', folderKey);
    
    const acmFolder1 = path.join(tcPath, 'ACM/Futures', folderKey);
    const acmFolder2 = path.join(bkPath, 'Backup ACM/Futures', folderKey);
    
    console.log(\`\\n>>> BẮT ĐẦU VÒNG LẶP CHO THÁNG \${month}/\${year} <<<\`);
    
    // 1. Quét tất cả các ngày từ Thứ 2 đến Thứ 6
    const daysSet = new Set();
    [msFolder1, msFolder2, cqgRawFolder1, cqgRawFolder2, acmFolder1, acmFolder2].forEach(p => {
        if (fs.existsSync(p)) {
            fs.readdirSync(p).forEach(d => {
                if (/^\\d{2}\\.\\d{2}$/.test(d)) daysSet.add(d);
            });
        }
    });
    
    const sortedDays = Array.from(daysSet).sort();
    
    let monthCqgLots = 0;
    let monthAcmLots = 0;
    const cqgMembers = {};
    const acmMembers = {};
    const dailyReport = [];
    
    for (const d of sortedDays) {
        // Kiểm tra xem có phải Thứ 7 hoặc CN không
        const [dayNum, mNum] = d.split('.').map(Number);
        const dateObj = new Date(Date.UTC(year, month - 1, dayNum, 12, 0, 0));
        const dayOfWeek = dateObj.getUTCDay(); // 0: Sun, 6: Sat
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        
        let dayCqg = 0;
        let dayCqgSource = 'NONE';
        let dayAcm = 0;
        let dayAcmSource = 'NONE';
        
        // A. XỬ LÝ KHỐI ACM (CHỈ TỪ BROKER ACM, KHÔNG DÙNG THỨ 7/CN)
        if (!isWeekend) {
            let bestAcmFile = null;
            let bestAcmSize = 0;
            for (const fld of [path.join(acmFolder1, d), path.join(acmFolder2, d)]) {
                if (!fs.existsSync(fld)) continue;
                for (const f of fs.readdirSync(fld)) {
                    const fp = path.join(fld, f);
                    const st = fs.statSync(fp);
                    if (!st.isFile()) continue;
                    if ((f.startsWith('Fill') && (f.endsWith('.xls') || f.endsWith('.xlsx'))) || (f.startsWith('Straits') && f.endsWith('.csv'))) {
                        if (st.size > bestAcmSize) {
                            bestAcmSize = st.size;
                            bestAcmFile = fp;
                        }
                    }
                }
            }
            if (bestAcmFile && bestAcmSize > 1000) {
                try {
                    const wb = XLSX.readFile(bestAcmFile);
                    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                    dayAcmSource = \`\${path.basename(bestAcmFile)} (\${(bestAcmSize/1024).toFixed(0)}K)\`;
                    for (const r of rows) {
                        const m = String(r['Trading Firm Id'] || r['Firm'] || r['Member'] || r['Account'] || '').trim().substring(0, 3);
                        const lot = Number(r['Volume'] || r['Qty'] || r['Lot'] || 0);
                        if (lot > 0 && m) {
                            dayAcm += lot;
                            monthAcmLots += lot;
                            acmMembers[m] = (acmMembers[m] || 0) + lot;
                        }
                    }
                } catch(e) {
                    dayAcmSource = 'ERR: ' + e.message;
                }
            }
        } else {
            dayAcmSource = 'WEEKEND (NO SESSION)';
        }
        
        // B. XỬ LÝ KHỐI CQG (DSGD.xlsx + AUTO-HEALING TỪ FR.xlsx)
        // 1. Tìm DSGD.xlsx
        let bestDsgdFile = null;
        let bestDsgdRows = [];
        let dsgdCqgLot = 0;
        
        for (const fld of [path.join(msFolder1, d), path.join(msFolder2, d)]) {
            const fp = path.join(fld, 'DSGD.xlsx');
            if (fs.existsSync(fp)) {
                try {
                    const wb = XLSX.readFile(fp);
                    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                    let tempLot = 0;
                    rows.forEach(r => {
                        const acc = String(r['Mã TKGD'] || '').trim().toUpperCase();
                        if (!acc.endsWith('A')) tempLot += Number(r['KL giao dịch'] || 0);
                    });
                    if (tempLot > dsgdCqgLot) {
                        dsgdCqgLot = tempLot;
                        bestDsgdRows = rows;
                        bestDsgdFile = fp;
                    }
                } catch(e) {}
            }
        }
        
        // 2. Tìm FR.xlsx (CQG Raw)
        let bestFrFile = null;
        let bestFrRows = [];
        let frCqgLot = 0;
        for (const fld of [path.join(cqgRawFolder1, d), path.join(cqgRawFolder2, d)]) {
            const fp = path.join(fld, 'FR.xlsx');
            if (fs.existsSync(fp)) {
                try {
                    const wb = XLSX.readFile(fp);
                    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                    let tempLot = 0;
                    rows.forEach(r => tempLot += Number(r['Qty'] || r['Quantity'] || r['Volume'] || r['Lot'] || 0));
                    if (tempLot > frCqgLot) {
                        frCqgLot = tempLot;
                        bestFrRows = rows;
                        bestFrFile = fp;
                    }
                } catch(e) {}
            }
        }
        
        // Quyết định nguồn CQG cho ngày d:
        // Nếu DSGD có số lot >= 500, dùng DSGD
        // Nếu DSGD bị cụt/hỏng (< 100) mà FR có lot lớn (> 500), tự động dùng FR (Auto-Healing!)
        if (dsgdCqgLot >= 500) {
            dayCqg = dsgdCqgLot;
            dayCqgSource = 'DSGD.xlsx';
            bestDsgdRows.forEach(r => {
                const acc = String(r['Mã TKGD'] || '').trim().toUpperCase();
                const lot = Number(r['KL giao dịch'] || 0);
                if (lot > 0 && acc && !acc.endsWith('A')) {
                    const m = acc.substring(0, 3);
                    cqgMembers[m] = (cqgMembers[m] || 0) + lot;
                }
            });
        } else if (frCqgLot >= 500) {
            dayCqg = frCqgLot;
            dayCqgSource = \`HEALED: FR.xlsx (\${bestFrRows.length} trades)\`;
            bestFrRows.forEach(r => {
                const acc = String(r['Account'] || '').trim().toUpperCase();
                const lot = Number(r['Qty'] || r['Quantity'] || r['Volume'] || r['Lot'] || 0);
                if (lot > 0 && acc) {
                    const m = acc.substring(0, 3);
                    cqgMembers[m] = (cqgMembers[m] || 0) + lot;
                }
            });
        } else if (dsgdCqgLot > 0) {
            dayCqg = dsgdCqgLot;
            dayCqgSource = 'DSGD.xlsx (Low vol)';
            bestDsgdRows.forEach(r => {
                const acc = String(r['Mã TKGD'] || '').trim().toUpperCase();
                const lot = Number(r['KL giao dịch'] || 0);
                if (lot > 0 && acc && !acc.endsWith('A')) {
                    const m = acc.substring(0, 3);
                    cqgMembers[m] = (cqgMembers[m] || 0) + lot;
                }
            });
        }
        
        monthCqgLots += dayCqg;
        
        // Chỉ lưu vào dailyReport nếu ngày đó có giao dịch hoặc là ngày trong tuần
        if (!isWeekend || dayCqg > 0 || dayAcm > 0) {
            dailyReport.push({
                day: d,
                isWeekend,
                cqgLots: dayCqg,
                cqgSource: dayCqgSource,
                acmLots: dayAcm,
                acmSource: dayAcmSource,
                total: dayCqg + dayAcm
            });
        }
    }
    
    console.log("NGÀY  |  CQG LOTS | NGUỒN CQG               |  ACM LOTS | NGUỒN ACM               | TỔNG NGÀY");
    console.log("------+-----------+-------------------------+-----------+-------------------------+----------");
    dailyReport.forEach(r => {
        console.log(
            \`\${r.day} | \` +
            \`\${String(r.cqgLots).padStart(9)} | \` +
            \`\${r.cqgSource.padEnd(23)} | \` +
            \`\${String(r.acmLots).padStart(9)} | \` +
            \`\${r.acmSource.padEnd(23)} | \` +
            \`\${String(r.total).padStart(9)}\`
        );
    });
    
    console.log("-----------------------------------------------------------------------------------------");
    console.log(\`TỔNG KẾT THÁNG \${month}/\${year}:\`);
    console.log(\`  - Tổng số phiên giao dịch: \${dailyReport.filter(x=>!x.isWeekend).length} phiên chuẩn\`);
    console.log(\`  - Khối lượng CQG: \${monthCqgLots.toLocaleString()} lots\`);
    console.log(\`  - Khối lượng ACM: \${monthAcmLots.toLocaleString()} lots\`);
    console.log(\`  - TỔNG TOÀN THỊ TRƯỜNG: \${(monthCqgLots + monthAcmLots).toLocaleString()} lots\`);
    console.log(\`  - Tỷ trọng ACM: \${((monthAcmLots/(monthCqgLots + monthAcmLots))*100).toFixed(2)}%\`);
    
    console.log("\\nTop 5 TVKD CQG:");
    Object.entries(cqgMembers).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([m,v], idx) => {
        console.log(\`  \${idx+1}. TVKD \${m}: \${v.toLocaleString()} lots (\${((v/monthCqgLots)*100).toFixed(2)}%)\`);
    });
    
    console.log("\\nTop 5 TVKD ACM:");
    Object.entries(acmMembers).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([m,v], idx) => {
        console.log(\`  \${idx+1}. TVKD \${m}: \${v.toLocaleString()} lots (\${((v/monthAcmLots)*100).toFixed(2)}%)\`);
    });
    
    return { month, year, cqg: monthCqgLots, acm: monthAcmLots, total: monthCqgLots + monthAcmLots };
}

const r10 = runMonthLoop(2026, 10);
const r11 = runMonthLoop(2026, 11);
`;

  const cmd = `cat << 'EOF' > /tmp/loop_full_healed.js\n${remoteNode}\nEOF\nnode /tmp/loop_full_healed.js\nrm -f /tmp/loop_full_healed.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

