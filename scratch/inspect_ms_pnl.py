import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

py_script = '''
import os, glob
import openpyxl

paths = [
    "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/20.10",
    "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026/20.10",
]

for p in paths:
    print(f"=== PATH: {p} ===")
    if not os.path.exists(p):
        print("  DOES NOT EXIST")
        continue
    files = glob.glob(os.path.join(p, "*.xlsx"))
    print("  Files found:", [os.path.basename(f) for f in files])
    for f in files:
        bname = os.path.basename(f)
        if any(k in bname.upper() for k in ["TTM", "TTTT", "DSGD"]):
            print(f"\\n  --> Inspecting {bname}:")
            try:
                wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
                sheet = wb.active
                rows = list(sheet.iter_rows(values_only=True))
                print(f"      Total rows: {len(rows)}")
                if len(rows) > 0:
                    headers = [str(c or "").strip() for c in rows[0]]
                    print(f"      Header (Row 0): {headers[:16]}")
                    for r_idx in range(1, min(4, len(rows))):
                        print(f"      Row {r_idx}: {rows[r_idx][:16]}")
            except Exception as e:
                print(f"      Error reading {bname}: {e}")
'''

stdin, stdout, stderr = ssh.exec_command(f"python3 -c '{py_script}'")
print(stdout.read().decode('utf-8', errors='replace'))
ssh.close()
