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

// Kiem tra chi tiet ngay 01.10 va 06.10:
for (const d of ['01.10', '06.10', '07.10', '12.10']) {
    console.log(\`\\n=================== KIỂM TRA NGÀY \${d} ===================\`);
    
    // 1. DSGD.xlsx
    const dsgdPath = path.join(ms_dir, d, 'DSGD.xlsx');
    let dsgdAcmTrades = [];
    if (fs.existsSync(dsgdPath)) {
        const wb = XLSX.readFile(dsgdPath);
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        for (const r of rows) {
            const acc = String(r['Mã TKGD'] || '').trim().toUpperCase();
            if (acc.endsWith('A')) {
                dsgdAcmTrades.push({
                    tradeId: r['Mã giao dịch'] || r['Mã lệnh'],
                    acc: acc,
                    hd: r['Mã HĐ'],
                    side: r['Chiều mua bán'],
                    lot: Number(r['KL giao dịch'] || 0),
                    time: r['Ngày giờ thực hiện']
                });
            }
        }
    }
    console.log(\`DSGD Nano Trades: \${dsgdAcmTrades.length} trades, \${dsgdAcmTrades.reduce((s,x)=>s+x.lot,0)} lots\`);
    if (dsgdAcmTrades.length > 0) {
        console.log("  Sample DSGD trade:", dsgdAcmTrades[0]);
    }
    
    // 2. Straits.csv
    let straitsFile = null;
    for (const folder of [path.join(bk_acm_dir, d), path.join(tc_acm_dir, d)]) {
        if (!fs.existsSync(folder)) continue;
        for (const f of fs.readdirSync(folder)) {
            if (f.startsWith('Straits') && f.endsWith('.csv')) {
                straitsFile = path.join(folder, f);
                break;
            }
        }
        if (straitsFile) break;
    }
    
    if (straitsFile) {
        const wb = XLSX.readFile(straitsFile);
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        let straitsLots = 0;
        for (const r of rows) {
            straitsLots += Number(r['Volume'] || r['Qty'] || 0);
        }
        console.log(\`Straits.csv: \${rows.length} trades, \${straitsLots} lots\`);
        if (rows.length > 0) {
            console.log("  Sample Straits row keys:", Object.keys(rows[0]));
            console.log("  Sample Straits trade:", rows[0]);
        }
    }
}
`;

  const cmd = `cat << 'EOF' > /tmp/check_overlap.js\n${remoteNode}\nEOF\nnode /tmp/check_overlap.js\nrm -f /tmp/check_overlap.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

