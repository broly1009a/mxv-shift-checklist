const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remotePython = `
import os
import openpyxl
from collections import defaultdict

ms_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026"

cqg_by_member = defaultdict(int)
acm_by_member = defaultdict(int)
daily_cqg = defaultdict(int)
daily_acm = defaultdict(int)

commodity_cqg = defaultdict(int)
commodity_acm = defaultdict(int)

total_cqg_lots = 0
total_acm_lots = 0

days = sorted([d for d in os.listdir(ms_dir) if os.path.isdir(os.path.join(ms_dir, d)) and len(d) == 5])

for d in days:
    dsgd_file = os.path.join(ms_dir, d, "DSGD.xlsx")
    if not os.path.exists(dsgd_file):
        continue
    
    try:
        wb = openpyxl.load_workbook(dsgd_file, data_only=True)
        ws = wb.active
        # Header ở row 1
        headers = [c for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
        col_map = {h: idx for idx, h in enumerate(headers) if h}
        
        acc_idx = col_map.get("Mã TKGD")
        hd_idx = col_map.get("Mã HĐ")
        kl_idx = col_map.get("KL giao dịch")
        tvkd_idx = col_map.get("Mã TVKD")
        
        for row in ws.iter_rows(min_row=2, values_only=True):
            acc = str(row[acc_idx] or "").strip().upper()
            hd = str(row[hd_idx] or "").strip().upper()
            kl_val = row[kl_idx]
            if not kl_val:
                continue
            try:
                kl = int(float(kl_val))
            except:
                continue
            
            member = acc[:3] if len(acc) >= 3 else str(row[tvkd_idx] or "").strip()
            
            if acc.endswith("A"):
                # ACM Nano
                acm_by_member[member] += kl
                daily_acm[d] += kl
                commodity_acm[hd] += kl
                total_acm_lots += kl
            else:
                # CQG
                cqg_by_member[member] += kl
                daily_cqg[d] += kl
                commodity_cqg[hd] += kl
                total_cqg_lots += kl
                
    except Exception as e:
        print(f"Error reading {d}: {e}")

print("==================================================")
print(f"KẾT QUẢ TÍNH TỪ DSGD.xlsx THÁNG 10/2026 (THEO CHUẨN C# ReportService):")
print(f"Số ngày giao dịch: {len(days)}")
print(f"Tổng số Lot CQG: {total_cqg_lots:,} lots")
print(f"Tổng số Lot ACM: {total_acm_lots:,} lots")
print(f"Tổng toàn thị trường: {total_cqg_lots + total_acm_lots:,} lots")
print("==================================================")

print("\\nTOP 10 TVKD KHỐI ACM (NANO):")
for m, v in sorted(acm_by_member.items(), key=lambda x: x[1], reverse=True)[:10]:
    print(f"  TVKD {m}: {v:,} lots")

print("\\nTOP 10 TVKD KHỐI CQG:")
for m, v in sorted(cqg_by_member.items(), key=lambda x: x[1], reverse=True)[:10]:
    print(f"  TVKD {m}: {v:,} lots")

print("\\nBIẾN ĐỘNG ACM THEO NGÀY:")
for d in sorted(daily_acm.keys()):
    print(f"  Ngày {d}: {daily_acm[d]:,} lots")
`;

  const cmd = `cat << 'EOF' > /tmp/calc_csharp_t10.py\n${remotePython}\nEOF\npython3 /tmp/calc_csharp_t10.py\nrm -f /tmp/calc_csharp_t10.py`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

