const path = require('path');
const { Client } = require(path.resolve('backend/node_modules/ssh2'));
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`NODE_PATH=/opt/mxv-checklist/backend/node_modules node -e "
    const fs = require('fs');
    const path = require('path');
    const XLSX = require('xlsx');
    const mongoose = require('mongoose');
    const { BGS_RAW_TO_STD_MAP } = require('/opt/mxv-checklist/backend/dist/modules/trading-ops/constants/bgs-commodity-catalog.constant');

    async function run() {
      await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
      console.log('MongoDB connected.');

      // 1. SEED THÁNG 09/2026 TỪ GROUND TRUTH SEED
      const seedPath = '/opt/mxv-checklist/backend/assets/reports/monthly_report_09_2026_seed.json';
      if (fs.existsSync(seedPath)) {
        const sampleData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
        await mongoose.connection.collection('monthly_report_snapshots').findOneAndUpdate(
          { monthYear: '2026-09' },
          {
            $set: {
              monthYear: '2026-09',
              status: 'OFFICIAL',
              section1Tvkd: sampleData.section1Tvkd,
              section2Commodities: sampleData.section2Commodities,
              section3Specials: sampleData.section3Specials,
              generatedBy: 'GROUND_TRUTH_SEED',
              note: 'Dữ liệu chuẩn nền tảng trích xuất 1:1 từ file gốc QLGD Bao cao thang 09.2026 - Final.xlsx',
              generatedAt: new Date(),
            }
          },
          { upsert: true }
        );
        console.log('[PASS] Tháng 09/2026 đã nạp thành công 1:1 từ file chuẩn nền tảng!');
      } else {
        console.warn('Seed file not found at:', seedPath);
      }

      // Helper function to sync a month
      async function syncMonth(year, month) {
        const monthStr = String(month).padStart(2, '0');
        const monthYear = \`\${year}-\${monthStr}\`;
        console.log(\`\\n--- BẮT ĐẦU ĐỒNG BỘ THÁNG \${monthYear} ---\`);

        const msBase = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures';
        const acmBase = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures';
        const subFolder = \`\${year}/T\${monthStr}.\${year}\`;
        const msMonthDir = path.join(msBase, subFolder);
        const acmMonthDir = path.join(acmBase, subFolder);

        const hasMs = fs.existsSync(msMonthDir);
        const hasAcm = fs.existsSync(acmMonthDir);
        console.log({ msMonthDir, hasMs, acmMonthDir, hasAcm });

        const daysSet = new Set();
        if (hasMs) {
          fs.readdirSync(msMonthDir).forEach(d => {
            if (/^\\d{2}\\.\\d{2}$/.test(d) && fs.statSync(path.join(msMonthDir, d)).isDirectory()) daysSet.add(d);
          });
        }
        if (hasAcm) {
          fs.readdirSync(acmMonthDir).forEach(d => {
            if (/^\\d{2}\\.\\d{2}$/.test(d) && fs.statSync(path.join(acmMonthDir, d)).isDirectory()) daysSet.add(d);
          });
        }

        const sortedDays = Array.from(daysSet).sort();
        console.log(\`Tìm thấy \${sortedDays.length} ngày giao dịch: \${sortedDays.join(', ')}\`);

        const acmMap = {
          'NSI': { stdCode: 'SI5CO', nameVn: 'Bạc Nano ACM' },
          'NPT': { stdCode: 'PL1NY', nameVn: 'Bạch kim Nano ACM' },
          'NPL': { stdCode: 'PL1NY', nameVn: 'Bạch kim Nano ACM' },
          'NCP': { stdCode: 'CP2CO', nameVn: 'Đồng Nano ACM' }
        };

        const tvkdNameMap = new Map();
        let monthCqgTrades = 0, monthCqgLot = 0, monthAcmTrades = 0, monthAcmLot = 0;
        let totalInserted = 0;

        for (const d of sortedDays) {
          const [dayPart] = d.split('.');
          const dateStr = \`\${year}-\${monthStr}-\${dayPart}\`;
          const dayAggMap = new Map();

          // MS / CQG
          const dsgdPath = path.join(msMonthDir, d, 'DSGD.xlsx');
          if (fs.existsSync(dsgdPath)) {
            const wb = XLSX.readFile(dsgdPath);
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            monthCqgTrades += rows.length;

            for (const r of rows) {
              const tvkdCode = String(r['Mã TVKD'] || '').trim();
              const tvkdName = String(r['Tên TVKD'] || '').trim() || tvkdCode;
              const acc = String(r['Mã TKGD'] || '').trim().toUpperCase();
              const hd = String(r['Mã HĐ'] || '').trim().toUpperCase();
              const side = String(r['Chiều mua bán'] || '').trim().toUpperCase();
              const lot = Number(r['KL giao dịch']) || 0;
              if (!tvkdCode || !hd || lot <= 0) continue;

              if (tvkdName && !tvkdNameMap.has(tvkdCode)) tvkdNameMap.set(tvkdCode, tvkdName);

              let root = hd;
              const optMatch = hd.match(/^([CP]\\.[A-Z0-9]+?)([FGHJKMNQUVXZ])(\\d{1,2})$/);
              const futMatch = hd.match(/^([A-Z0-9]+?)([FGHJKMNQUVXZ])(\\d{1,2})$/);
              if (optMatch) root = optMatch[1];
              else if (futMatch) root = futMatch[1];

              const info = BGS_RAW_TO_STD_MAP[root] || BGS_RAW_TO_STD_MAP[hd];
              const productCode = info?.stdCode || root;
              const productNameVi = info?.nameVn || hd;

              const isSpread = acc.endsWith('-S');
              const isLme = acc.endsWith('L') || acc.endsWith('-L');
              const isOptions = /^[CP]\\./i.test(hd);

              const key = \`CQG__\${tvkdCode}__\${productCode}__\${isSpread}__\${isLme}__\${isOptions}\`;
              let item = dayAggMap.get(key);
              if (!item) {
                item = {
                  date: dateStr,
                  system: 'CQG',
                  tvkdCode,
                  tvkdName,
                  productCode,
                  productNameVi,
                  lotBuy: 0,
                  lotSell: 0,
                  lotTotal: 0,
                  gtgdVnd: 0,
                  isSpread,
                  isLme,
                  isOptions
                };
                dayAggMap.set(key, item);
              }
              if (side === 'BUY' || side === 'MUA') item.lotBuy += lot;
              else item.lotSell += lot;
              item.lotTotal += lot;
              monthCqgLot += lot;
            }
          }

          // ACM
          const fillPath = path.join(acmMonthDir, d, 'Fill.xls');
          if (fs.existsSync(fillPath)) {
            const wb = XLSX.readFile(fillPath);
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            monthAcmTrades += rows.length;

            for (const r of rows) {
              const tvkdCode = String(r['Trading Firm Id'] || '').trim();
              const tvkdName = tvkdNameMap.get(tvkdCode) || \`TVKD \${tvkdCode}\`;
              const inst = String(r['Instrument Id'] || '').trim().toUpperCase();
              const side = String(r['B/S'] || '').trim().toUpperCase();
              const lot = Number(r['Volume']) || 0;
              if (!tvkdCode || !inst || lot <= 0) continue;

              let matchedComm = null;
              for (const [k, v] of Object.entries(acmMap)) {
                if (inst.includes(k)) { matchedComm = v; break; }
              }

              const productCode = matchedComm?.stdCode || 'ACM_NANO';
              const productNameVi = matchedComm?.nameVn || 'Nano ACM';

              const key = \`ACM__\${tvkdCode}__\${productCode}__false__false__false\`;
              let item = dayAggMap.get(key);
              if (!item) {
                item = {
                  date: dateStr,
                  system: 'ACM',
                  tvkdCode,
                  tvkdName,
                  productCode,
                  productNameVi,
                  lotBuy: 0,
                  lotSell: 0,
                  lotTotal: 0,
                  gtgdVnd: 0,
                  isSpread: false,
                  isLme: false,
                  isOptions: false
                };
                dayAggMap.set(key, item);
              }
              if (side === 'B') item.lotBuy += lot;
              else item.lotSell += lot;
              item.lotTotal += lot;
              monthAcmLot += lot;
            }
          }

          // Lưu CSDL
          await mongoose.connection.collection('daily_trading_stats').deleteMany({ date: dateStr });
          if (dayAggMap.size > 0) {
            const docs = Array.from(dayAggMap.values()).map(x => ({ ...x, createdAt: new Date(), updatedAt: new Date() }));
            await mongoose.connection.collection('daily_trading_stats').insertMany(docs);
            totalInserted += docs.length;
          }
        }

        console.log(\`Tổng kết tháng \${monthYear}:\`, {
          days: sortedDays.length,
          cqgTrades: monthCqgTrades,
          cqgLot: monthCqgLot,
          acmTrades: monthAcmTrades,
          acmLot: monthAcmLot,
          dailyStatsInserted: totalInserted
        });
      }

      await syncMonth(2026, 10);
      await syncMonth(2026, 11);

      const totalStats = await mongoose.connection.collection('daily_trading_stats').countDocuments();
      console.log(\`\\n[HOÀN TẤT] Tổng số bản ghi trong daily_trading_stats: \${totalStats}\`);
      process.exit(0);
    }
    run().catch(err => { console.error(err); process.exit(1); });
  "`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end());
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});

