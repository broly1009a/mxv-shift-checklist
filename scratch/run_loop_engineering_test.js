const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const fs = require('fs');
const path = require('path');
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

console.log("================================================================================");
console.log("               AUTOMATED LOOP ENGINEERING TEST SUITE                            ");
console.log("             Testing Aggregation Engine Across T10 & T11                        ");
console.log("================================================================================");

// 1. Thư mục cấu hình
const msBase = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures";
const acmBase = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures";
const tcBase = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures";
const tcAcmBase = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/ACM/Futures";

// 2. Tra cứu hàng hóa chuẩn
const COMMODITY_MAP = {
    'ZCE': { code: 'C', name: 'Ngô' },
    'ZSE': { code: 'S', name: 'Đậu tương' },
    'ZME': { code: 'SM', name: 'Khô đậu tương' },
    'ZLE': { code: 'BO', name: 'Dầu đậu tương' },
    'ZWA': { code: 'W', name: 'Lúa mì CBOT' },
    'KWE': { code: 'KW', name: 'Lúa mì KC' },
    'KCE': { code: 'KC', name: 'Cà phê Arabica' },
    'RCE': { code: 'RC', name: 'Cà phê Robusta' },
    'CCE': { code: 'CC', name: 'Ca cao' },
    'CTE': { code: 'CT', name: 'Bông sợi' },
    'SBE': { code: 'SB', name: 'Đường 11' },
    'QWE': { code: 'QW', name: 'Đường trắng' },
    'CPE': { code: 'CPE', name: 'Dầu cọ' },
    'CLE': { code: 'CL', name: 'Dầu WTI' },
    'BEE': { code: 'BZ', name: 'Dầu Brent' },
    'NGE': { code: 'NG', name: 'Khí tự nhiên' },
    'HOE': { code: 'HO', name: 'Dầu sưởi' },
    'RBE': { code: 'RB', name: 'Xăng RBOB' },
    'CME': { code: 'HG', name: 'Đồng CME' },
    'CPE2': { code: 'CP2CO', name: 'Đồng Nano ACM' },
    'SIE': { code: 'SI', name: 'Bạc' },
    'SI5': { code: 'SI5CO', name: 'Bạc Nano ACM' },
    'PLE': { code: 'PL', name: 'Bạch kim' },
    'PL1': { code: 'PL1NY', name: 'Bạch kim Nano ACM' },
    'PAE': { code: 'PA', name: 'Palladium' },
    'NSI': { code: 'SI5CO', name: 'Bạc Nano ACM' },
    'NPT': { code: 'PL1NY', name: 'Bạch kim Nano ACM' },
    'NPL': { code: 'PL1NY', name: 'Bạch kim Nano ACM' },
    'NCP': { code: 'CP2CO', name: 'Đồng Nano ACM' },
};

function resolveCommodity(rawSymbol) {
    if (!rawSymbol) return { code: 'OTHER', name: 'Khác' };
    const clean = rawSymbol.trim().toUpperCase();
    for (const [prefix, val] of Object.entries(COMMODITY_MAP)) {
        if (clean.includes(prefix)) return val;
    }
    return { code: clean, name: clean };
}

// Hàm Test Engine cho một tháng
function runLoopEngineeringMonth(year, month) {
    const monthStr = String(month).padStart(2, '0');
    const folderKey = \`\${year}/T\${monthStr}.\${year}\`;
    
    const msMonthDir = path.join(msBase, folderKey);
    const acmMonthDir = path.join(acmBase, folderKey);
    const tcMonthDir = path.join(tcBase, folderKey);
    const tcAcmMonthDir = path.join(tcAcmBase, folderKey);
    
    console.log(\`\\n>>> BẮT ĐẦU TEST LOOP CHO THÁNG \${month}/\${year} <<<\`);
    console.log(\`  MS Dir: \${msMonthDir} (Exists: \${fs.existsSync(msMonthDir)})\`);
    console.log(\`  ACM Dir: \${acmMonthDir} (Exists: \${fs.existsSync(acmMonthDir)})\`);
    console.log(\`  TC ACM Dir: \${tcAcmMonthDir} (Exists: \${fs.existsSync(tcAcmMonthDir)})\`);
    
    const daysSet = new Set();
    [msMonthDir, acmMonthDir, tcMonthDir, tcAcmMonthDir].forEach(p => {
        if (fs.existsSync(p)) {
            fs.readdirSync(p).forEach(d => {
                if (/^\\d{2}\\.\\d{2}$/.test(d)) daysSet.add(d);
            });
        }
    });
    
    const sortedDays = Array.from(daysSet).sort();
    console.log(\`  Tổng số ngày phát hiện: \${sortedDays.length} ngày: \${sortedDays.join(', ')}\`);
    
    // Aggregation State
    let totalCqgLots = 0;
    let totalCqgTrades = 0;
    let totalAcmLots = 0;
    let totalAcmTrades = 0;
    let totalSpreadLots = 0;
    let totalLmeLots = 0;
    let totalOptionLots = 0;
    
    const tvkdCqgMap = new Map();
    const tvkdAcmMap = new Map();
    const dailyAuditLog = [];
    
    // VÒNG LẶP TEST ENGINE TỪNG NGÀY (DAILY LOOP)
    for (let i = 0; i < sortedDays.length; i++) {
        const d = sortedDays[i];
        const dayStat = {
            day: d,
            cqgLots: 0,
            cqgTrades: 0,
            acmLots: 0,
            acmTrades: 0,
            acmSource: 'NONE',
            spreadLots: 0,
            lmeLots: 0,
            optionLots: 0,
            errors: []
        };
        
        // ----------------------------------------------------
        // BƯỚC 1: XỬ LÝ MS DSGD.xlsx (CQG & Phân loại)
        // ----------------------------------------------------
        let dsgdPath = path.join(msMonthDir, d, 'DSGD.xlsx');
        if (!fs.existsSync(dsgdPath) && fs.existsSync(tcMonthDir)) {
            dsgdPath = path.join(tcMonthDir, d, 'DSGD.xlsx');
        }
        
        let dsgdAcmBuffer = [];
        
        if (fs.existsSync(dsgdPath)) {
            try {
                const wb = XLSX.readFile(dsgdPath);
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                dayStat.cqgTrades = rows.length;
                
                for (const r of rows) {
                    const acc = String(r['Mã TKGD'] || '').trim().toUpperCase();
                    const hd = String(r['Mã HĐ'] || '').trim().toUpperCase();
                    const lot = Number(r['KL giao dịch'] || 0);
                    if (lot <= 0 || !acc) continue;
                    
                    const tvkd = acc.substring(0, 3);
                    const isSpread = acc.endsWith('S') || acc.endsWith('-S');
                    const isLme = acc.endsWith('L') || acc.endsWith('-L');
                    const isOption = hd.startsWith('C.') || hd.startsWith('P.') || hd.includes('C.') || hd.includes('P.');
                    
                    if (isSpread) { totalSpreadLots += lot; dayStat.spreadLots += lot; }
                    if (isLme) { totalLmeLots += lot; dayStat.lmeLots += lot; }
                    if (isOption) { totalOptionLots += lot; dayStat.optionLots += lot; }
                    
                    // Phân loại ACM vs CQG theo chuẩn C# ReportService.cs
                    if (acc.endsWith('A')) {
                        dsgdAcmBuffer.push({ tvkd, lot, hd });
                    } else {
                        dayStat.cqgLots += lot;
                        totalCqgLots += lot;
                        totalCqgTrades++;
                        tvkdCqgMap.set(tvkd, (tvkdCqgMap.get(tvkd) || 0) + lot);
                    }
                }
            } catch (err) {
                dayStat.errors.push(\`DSGD parse error: \${err.message}\`);
            }
        }
        
        // ----------------------------------------------------
        // BƯỚC 2: XỬ LÝ FILE ACM NGOÀI (Ưu tiên: Fill.xls -> Fill.xlsx -> Straits.csv)
        // ----------------------------------------------------
        let bestAcmFile = null;
        let bestSize = 0;
        
        const candidateFolders = [
            path.join(acmMonthDir, d),
            path.join(tcAcmMonthDir, d)
        ];
        
        for (const fld of candidateFolders) {
            if (!fs.existsSync(fld)) continue;
            const files = fs.readdirSync(fld);
            for (const f of files) {
                const fp = path.join(fld, f);
                const st = fs.statSync(fp);
                if (!st.isFile()) continue;
                
                // Tiêu chí nhận diện: Fill*.xls, Fill*.xlsx, Straits*.csv
                const isFill = f.startsWith('Fill') && (f.endsWith('.xls') || f.endsWith('.xlsx'));
                const isStraits = f.startsWith('Straits') && f.endsWith('.csv');
                
                if (isFill || isStraits) {
                    if (st.size > bestSize) {
                        bestSize = st.size;
                        bestAcmFile = fp;
                    }
                }
            }
        }
        
        if (bestAcmFile && bestSize > 1000) {
            try {
                const wb = XLSX.readFile(bestAcmFile);
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                dayStat.acmSource = \`BROKER: \${path.basename(bestAcmFile)} (\${(bestSize/1024).toFixed(1)}KB)\`;
                dayStat.acmTrades = rows.length;
                
                for (const r of rows) {
                    const tvkd = String(r['Trading Firm Id'] || r['Firm'] || r['Member'] || r['Account'] || '').trim().substring(0, 3);
                    const lot = Number(r['Volume'] || r['Qty'] || r['Lot'] || 0);
                    if (lot > 0 && tvkd) {
                        dayStat.acmLots += lot;
                        totalAcmLots += lot;
                        totalAcmTrades++;
                        tvkdAcmMap.set(tvkd, (tvkdAcmMap.get(tvkd) || 0) + lot);
                    }
                }
            } catch (err) {
                dayStat.errors.push(\`ACM file parse error: \${err.message}\`);
            }
        } else if (dsgdAcmBuffer.length > 0) {
            // FALLBACK: Lấy từ DSGD buffer nếu không có file broker
            dayStat.acmSource = \`DSGD_FALLBACK (\${dsgdAcmBuffer.length} trades)\`;
            for (const item of dsgdAcmBuffer) {
                dayStat.acmLots += item.lot;
                totalAcmLots += item.lot;
                totalAcmTrades++;
                tvkdAcmMap.set(item.tvkd, (tvkdAcmMap.get(item.tvkd) || 0) + item.lot);
            }
        }
        
        dailyAuditLog.push(dayStat);
    }
    
    // IN BẢNG KIỂM TRA LOOP TỪNG NGÀY
    console.log("\\n--- BẢNG AUDIT CHI TIẾT TỪNG NGÀY GIAO DỊCH (LOOP RESULTS) ---");
    console.log("NGÀY  | CQG LOTS | ACM LOTS | TỔNG LOTS | NGUỒN ACM                              | ERRORS");
    console.log("------+----------+----------+-----------+----------------------------------------+-------");
    dailyAuditLog.forEach(row => {
        const total = row.cqgLots + row.acmLots;
        const errStr = row.errors.length > 0 ? row.errors.join('; ') : 'OK';
        console.log(
            \`\${row.day} | \` +
            \`\${String(row.cqgLots).padStart(8)} | \` +
            \`\${String(row.acmLots).padStart(8)} | \` +
            \`\${String(total).padStart(9)} | \` +
            \`\${row.acmSource.padEnd(38)} | \` +
            \`\${errStr}\`
        );
    });
    
    console.log("--------------------------------------------------------------------------------");
    console.log(\`TỔNG KẾT THÁNG \${month}/\${year}:\`);
    console.log(\`  - Tổng số ngày xử lý: \${sortedDays.length} ngày\`);
    console.log(\`  - Khối lượng CQG: \${totalCqgLots.toLocaleString()} lots (\${totalCqgTrades.toLocaleString()} trades)\`);
    console.log(\`  - Khối lượng ACM: \${totalAcmLots.toLocaleString()} lots (\${totalAcmTrades.toLocaleString()} trades)\`);
    console.log(\`  - TỔNG TOÀN THỊ TRƯỜNG: \${(totalCqgLots + totalAcmLots).toLocaleString()} lots\`);
    console.log(\`  - Tỷ trọng ACM/Toàn TT: \${((totalAcmLots/(totalCqgLots + totalAcmLots))*100).toFixed(2)}%\`);
    console.log(\`  - Sản phẩm đặc thù: Spread=\${totalSpreadLots.toLocaleString()} lots | LME=\${totalLmeLots.toLocaleString()} lots | Options=\${totalOptionLots.toLocaleString()} lots\`);
    
    console.log("\\nTOP 5 TVKD KHỐI CQG:");
    Array.from(tvkdCqgMap.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([m,v], idx) => {
        console.log(\`  \${idx+1}. TVKD \${m}: \${v.toLocaleString()} lots (\${((v/totalCqgLots)*100).toFixed(2)}%)\`);
    });
    
    console.log("\\nTOP 5 TVKD KHỐI ACM:");
    Array.from(tvkdAcmMap.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([m,v], idx) => {
        console.log(\`  \${idx+1}. TVKD \${m}: \${v.toLocaleString()} lots (\${((v/totalAcmLots)*100).toFixed(2)}%)\`);
    });
    
    return {
        month,
        year,
        days: sortedDays.length,
        totalCqgLots,
        totalAcmLots,
        totalMarket: totalCqgLots + totalAcmLots
    };
}

// CHẠY TEST ENGINE CHO CẢ THÁNG 10 VÀ THÁNG 11
const resT10 = runLoopEngineeringMonth(2026, 10);
const resT11 = runLoopEngineeringMonth(2026, 11);

console.log("\\n================================================================================");
console.log("                    KẾT QUẢ KIỂM THỬ LOOP TOÀN DIỆN                             ");
console.log("================================================================================");
console.log(\`Tháng 10/2026: \${resT10.days} ngày | CQG: \${resT10.totalCqgLots.toLocaleString()} | ACM: \${resT10.totalAcmLots.toLocaleString()} | Tổng: \${resT10.totalMarket.toLocaleString()} lots\`);
console.log(\`Tháng 11/2026: \${resT11.days} ngày | CQG: \${resT11.totalCqgLots.toLocaleString()} | ACM: \${resT11.totalAcmLots.toLocaleString()} | Tổng: \${resT11.totalMarket.toLocaleString()} lots\`);
console.log("================================================================================");
`;

  const cmd = `cat << 'EOF' > /tmp/loop_engineering_test.js\n${remoteNode}\nEOF\nnode /tmp/loop_engineering_test.js\nrm -f /tmp/loop_engineering_test.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

