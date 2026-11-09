const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remotePython = `
import os
import openpyxl

ms_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026"
days = sorted([d for d in os.listdir(ms_dir) if os.path.isdir(os.path.join(ms_dir, d)) and len(d) == 5])

for d in days:
    dsgd_file = os.path.join(ms_dir, d, "DSGD.xlsx")
    if not os.path.exists(dsgd_file):
        continue
    wb = openpyxl.load_workbook(dsgd_file, data_only=True)
    ws = wb.active
    headers = [c for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
    col_map = {h: idx for idx, h in enumerate(headers) if h}
    acc_idx = col_map.get("Mã TKGD")
    hd_idx = col_map.get("Mã HĐ")
    kl_idx = col_map.get("KL giao dịch")
    
    nano_count = 0
    nano_lots = 0
    total_count = 0
    total_lots = 0
    all_acc_suffixes = set()
    
    for row in ws.iter_rows(min_row=2, values_only=True):
        acc = str(row[acc_idx] or "").strip().upper()
        if not acc:
            continue
        total_count += 1
        kl = int(float(row[kl_idx] or 0))
        total_lots += kl
        if acc[-1] in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
            all_acc_suffixes.add(acc[-1])
        if acc.endswith("A"):
            nano_count += 1
            nano_lots += kl
            
    print(f"Day {d}: Total trades={total_count}, Total lots={total_lots} | Nano trades={nano_count}, Nano lots={nano_lots} | Suffixes={all_acc_suffixes}")
`;

  const cmd = `cat << 'EOF' > /tmp/check_dsgd_suffixes.py\n${remotePython}\nEOF\npython3 /tmp/check_dsgd_suffixes.py\nrm -f /tmp/check_dsgd_suffixes.py`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

