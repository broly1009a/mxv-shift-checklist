const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const { MongoClient } = require('/opt/mxv-checklist/backend/node_modules/mongodb');

async function main() {
    const client = new MongoClient('mongodb://127.0.0.1:27017/mxv_shift_checklist');
    await client.connect();
    const db = client.db('mxv_shift_checklist');

    console.log("==================================================");
    console.log("=== KIỂM TRA RÀ SOÁT LẦN 2 (POST-REFRESH AUDIT) ===");
    console.log("==================================================");

    // 1. Kiểm tra DailyTradingStats
    const statsCol = db.collection('daily_trading_stats');
    const octStats = await statsCol.find({ date: /^2026-10/ }).toArray();
    const distinctDates = Array.from(new Set(octStats.map(s => s.date))).sort();
    
    console.log("\\n1. DỮ LIỆU DAILY TRADING STATS (NGÀY GIAO DỊCH):");
    console.log(\`  - Tổng số bản ghi (daily records): \${octStats.length}\`);
    console.log(\`  - Tổng số ngày phân biệt: \${distinctDates.length} ngày\`);
    console.log(\`  - Danh sách ngày: \${distinctDates.join(', ')}\`);

    const weekendDates = distinctDates.filter(d => {
        const [y, m, day] = d.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
        return dt.getUTCDay() === 0 || dt.getUTCDay() === 6;
    });
    console.log(\`  - Số ngày cuối tuần (T7, CN) lọt vào: \${weekendDates.length} \${weekendDates.length === 0 ? '✓ (HOÀN TOÀN SẠCH)' : '✗ (CÒN LỖI: ' + weekendDates.join(', ') + ')'}\`);

    let cqgDailySum = 0;
    let acmDailySum = 0;
    octStats.forEach(s => {
        if (s.system === 'CQG') cqgDailySum += (s.lotTotal || 0);
        else if (s.system === 'ACM') acmDailySum += (s.lotTotal || 0);
    });
    console.log(\`  - Tổng Lot CQG từ daily stats: \${cqgDailySum.toLocaleString()} lots\`);
    console.log(\`  - Tổng Lot ACM từ daily stats: \${acmDailySum.toLocaleString()} lots\`);
    console.log(\`  - Tổng Lot Toàn thị trường: \${(cqgDailySum + acmDailySum).toLocaleString()} lots\`);

    // 2. Kiểm tra Snapshot Tháng 10/2026
    console.log("\\n2. SNAPSHOT BÁO CÁO THÁNG (monthly_report_snapshots):");
    const snapCol = db.collection('monthly_report_snapshots');
    const snap = await snapCol.findOne({ monthYear: '2026-10' });
    if (!snap) {
        console.log("  ✗ KHÔNG TÌM THẤY SNAPSHOT 2026-10 TRONG CSDL!");
        await client.close();
        return;
    }

    console.log(\`  - Status: \${snap.status}\`);
    console.log(\`  - Thời điểm tạo (generatedAt): \${snap.generatedAt}\`);
    console.log(\`  - Người tạo / Nguồn (generatedBy): \${snap.generatedBy}\`);
    console.log(\`  - Ghi chú (note): \${snap.note}\`);

    const s1 = snap.section1Tvkd || {};
    const cqgSummary = s1.cqg?.summary || {};
    const acmSummary = s1.acm?.summary || {};

    console.log("\\n3. TỔNG HỢP SECTION 1 (XẾP HẠNG TVKD):");
    console.log(\`  - CQG Summary: Lot T-1=\${(cqgSummary.lotPreviousMonth || 0).toLocaleString()}, Lot T=\${(cqgSummary.lotCurrentMonth || 0).toLocaleString()} (Tăng: \${cqgSummary.growthPercent}), Số phiên: \${cqgSummary.tradingDaysCount}\`);
    console.log(\`    Đỉnh CQG: \${cqgSummary.marketPeakDate} (\${(cqgSummary.marketPeakLot || 0).toLocaleString()} lots) | Đáy CQG: \${cqgSummary.marketTroughDate} (\${(cqgSummary.marketTroughLot || 0).toLocaleString()} lots)\`);
    console.log(\`  - ACM Summary: Lot T-1=\${(acmSummary.lotPreviousMonth || 0).toLocaleString()}, Lot T=\${(acmSummary.lotCurrentMonth || 0).toLocaleString()} (Tăng: \${acmSummary.growthPercent}), Số phiên: \${acmSummary.tradingDaysCount}\`);
    console.log(\`    Đỉnh ACM: \${acmSummary.marketPeakDate} (\${(acmSummary.marketPeakLot || 0).toLocaleString()} lots) | Đáy ACM: \${acmSummary.marketTroughDate} (\${(acmSummary.marketTroughLot || 0).toLocaleString()} lots)\`);

    const cqgItems = s1.cqg?.items || [];
    const acmItems = s1.acm?.items || [];
    console.log(\`  - Số lượng TVKD CQG: \${cqgItems.length} TVKD\`);
    console.log(\`  - Số lượng TVKD ACM: \${acmItems.length} TVKD\`);

    console.log("\\n  --- TOP 5 TVKD CQG ---");
    cqgItems.slice(0, 5).forEach(m => {
        console.log(\`    STT \${m.stt}: TVKD \${m.tvkdCode} (\${m.tvkdName}) | Lot: \${(m.lotCurrentMonth || 0).toLocaleString()} | Đỉnh: \${m.maxDate} (\${(m.maxLotDay || 0).toLocaleString()}) | Đáy: \${m.minDate} (\${(m.minLotDay || 0).toLocaleString()}) | Phiên: \${m.tradingDaysCount}\`);
    });

    console.log("\\n  --- TOP 5 TVKD ACM ---");
    acmItems.slice(0, 5).forEach(m => {
        console.log(\`    STT \${m.stt}: TVKD \${m.tvkdCode} (\${m.tvkdName}) | Lot: \${(m.lotCurrentMonth || 0).toLocaleString()} | Đỉnh: \${m.maxDate} (\${(m.maxLotDay || 0).toLocaleString()}) | Đáy: \${m.minDate} (\${(m.minLotDay || 0).toLocaleString()}) | Phiên: \${m.tradingDaysCount}\`);
    });

    // 4. Kiểm tra Section 2: Mặt Hàng
    const s2 = snap.section2Commodities || {};
    const cqgComms = s2.cqg?.items || [];
    const acmComms = s2.acm?.items || [];
    console.log("\\n4. SECTION 2 (CƠ CẤU MẶT HÀNG):");
    console.log(\`  - Tổng mặt hàng CQG: \${cqgComms.length}\`);
    console.log("  --- TOP 5 HÀNG HÓA CQG ---");
    cqgComms.slice(0, 5).forEach(c => {
        console.log(\`    STT \${c.stt}: \${c.commodityName} | Lot: \${(c.lotCurrentMonth || 0).toLocaleString()} | Thị phần: \${c.marketSharePercent}\`);
    });
    console.log(\`  - Tổng mặt hàng ACM: \${acmComms.length}\`);
    acmComms.forEach(c => {
        console.log(\`    STT \${c.stt}: \${c.commodityName} | Lot: \${(c.lotCurrentMonth || 0).toLocaleString()} | Thị phần: \${c.marketSharePercent}\`);
    });

    // 5. Kiểm tra Section 3: Sản Phẩm Đặc Thù
    const s3 = snap.section3Specials || {};
    console.log("\\n5. SECTION 3 (SẢN PHẨM ĐẶC THÙ):");
    ['spread', 'lme', 'options'].forEach(k => {
        const sec = s3[k];
        console.log(\`  - Phân khúc \${k.toUpperCase()}: \${sec?.totalMembers || 0} TVKD | Lot T-1=\${(sec?.summary?.lotPreviousMonth || 0).toLocaleString()} | Lot T=\${(sec?.summary?.lotCurrentMonth || 0).toLocaleString()}\`);
    });

    await client.close();
}
main().catch(console.error);
`;

  const cmd = `cat << 'EOF' > /tmp/audit_second_pass.js\n${remoteNode}\nEOF\nnode /tmp/audit_second_pass.js\nrm -f /tmp/audit_second_pass.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

