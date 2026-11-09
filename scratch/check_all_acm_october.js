const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remotePython = `
import os
import openpyxl
import csv
from collections import defaultdict

tc_acm_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/ACM/Futures/2026/T10.2026"
backup_acm_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026/T10.2026"

print("=== CHECKING ACM FILES IN TradingCheck & Backup ACM ===")

days = set()
if os.path.exists(tc_acm_dir):
    days.update(os.listdir(tc_acm_dir))
if os.path.exists(backup_acm_dir):
    days.update(os.listdir(backup_acm_dir))

days = sorted([d for d in days if len(d) == 5])

total_acm_vol = 0
by_member = defaultdict(int)

for d in days:
    p1 = os.path.join(tc_acm_dir, d)
    p2 = os.path.join(backup_acm_dir, d)
    
    # Tim file uu tien: Fill.xlsx -> Fill.xls -> Straits.csv
    found_file = None
    ftype = None
    for folder in [p1, p2]:
        if not os.path.exists(folder):
            continue
        for fname in ["Fill.xlsx", "Fill.xls"]:
            fp = os.path.join(folder, fname)
            if os.path.exists(fp):
                found_file = fp
                ftype = "excel"
                break
        if found_file:
            break
        for f in os.listdir(folder):
            if "Straits" in f and f.endswith(".csv"):
                found_file = os.path.join(folder, f)
                ftype = "csv"
                break
        if found_file:
            break
            
    if not found_file:
        print(f"Day {d}: NO ACM FILE")
        continue
        
    day_vol = 0
    if ftype == "excel":
        try:
            wb = openpyxl.load_workbook(found_file, data_only=True)
            ws = wb.active
            headers = [c for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
            col_map = {h: idx for idx, h in enumerate(headers) if h}
            tvkd_idx = col_map.get("Trading Firm Id") or col_map.get("Member")
            vol_idx = col_map.get("Volume") or col_map.get("Qty")
            
            for row in ws.iter_rows(min_row=2, values_only=True):
                m = str(row[tvkd_idx] or "").strip()
                v = int(float(row[vol_idx] or 0))
                by_member[m] += v
                day_vol += v
        except Exception as e:
            print(f"Day {d} excel err: {e}")
    elif ftype == "csv":
        try:
            with open(found_file, "r", encoding="utf-8", errors="ignore") as f:
                reader = csv.reader(f)
                header = next(reader)
                # Tim col Volume
                vol_col = -1
                firm_col = -1
                for idx, h in enumerate(header):
                    if "Volume" in h or "Qty" in h or "Lot" in h:
                        vol_col = idx
                    if "Firm" in h or "Member" in h or "Account" in h:
                        firm_col = idx
                for row in reader:
                    if vol_col >= 0 and len(row) > vol_col:
                        try:
                            v = int(float(row[vol_col] or 0))
                            m = row[firm_col][:3] if firm_col >= 0 and len(row) > firm_col else "UNKNOWN"
                            by_member[m] += v
                            day_vol += v
                        except:
                            pass
        except Exception as e:
            print(f"Day {d} csv err: {e}")
            
    print(f"Day {d} ({os.path.basename(found_file)}): vol = {day_vol:,}")
    total_acm_vol += day_vol

print("--------------------------------------------------")
print(f"TOTAL ACM VOLUME IN OCTOBER FROM EXTERNAL FILES: {total_acm_vol:,}")
print("By Member:")
for m, v in sorted(by_member.items(), key=lambda x: x[1], reverse=True)[:10]:
    print(f"  TVKD {m}: {v:,}")
`;

  const cmd = `cat << 'EOF' > /tmp/check_all_acm.py\n${remotePython}\nEOF\npython3 /tmp/check_all_acm.py\nrm -f /tmp/check_all_acm.py`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

