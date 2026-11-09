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

const days = fs.readdirSync(ms_dir).filter(d => /^\\d{2}\\.\\d{2}$/.test(d)).sort();

console.log('NGÀY | DSGD_CQG | DSGD_ACM | ACM_FILE (STRAITS/FILL) | TÊN FILE ACM');
console.log('----------------------------------------------------------------------');

let sumCqg = 0;
let sumDsgdAcm = 0;
let sumExtAcm = 0;

for (const d of days) {
    let dsgdCqg = 0;
    let dsgdAcm = 0;
    
    // 1. Doc DSGD
    const dsgdPath = path.join(ms_dir, d, 'DSGD.xlsx');
    if (fs.existsSync(dsgdPath)) {
        try {
            const wb = XLSX.readFile(dsgdPath);
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            for (const r of rows) {
                const acc = String(r['Mã TKGD'] || '').trim().toUpperCase();
                const lot = Number(r['KL giao dịch'] || 0);
                if (lot > 0) {
                    if (acc.endsWith('A')) dsgdAcm += lot;
                    else dsgdCqg += lot;
                }
            }
        } catch(e) {}
    }
    
    // 2. Doc file ACM ngoai (TradingCheck hoac Backup ACM)
    let extAcm = 0;
    let extFileName = 'KHÔNG CÓ';
    
    // Tim file to nhat trong cac thu muc
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
    
    if (bestFile) {
        extFileName = path.basename(bestFile);
        try {
            const wb = XLSX.readFile(bestFile);
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            for (const r of rows) {
                const lot = Number(r['Volume'] || r['Qty'] || r['Lot'] || 0);
                if (lot > 0) extAcm += lot;
            }
        } catch(e) {
            extFileName += ' (ERR: ' + e.message + ')';
        }
    }
    
    console.log(\`\${d} | \${String(dsgdCqg).padStart(8)} | \${String(dsgdAcm).padStart(8)} | \${String(extAcm).padStart(23)} | \${extFileName}\`);
    sumCqg += dsgdCqg;
    sumDsgdAcm += dsgdAcm;
    sumExtAcm += extAcm;
}

console.log('----------------------------------------------------------------------');
console.log(\`TỔNG | \${String(sumCqg).padStart(8)} | \${String(sumDsgdAcm).padStart(8)} | \${String(sumExtAcm).padStart(23)} |\`);
`;

  const cmd = `cat << 'EOF' > /tmp/compare_daily.js\n${remoteNode}\nEOF\nnode /tmp/compare_daily.js\nrm -f /tmp/compare_daily.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

