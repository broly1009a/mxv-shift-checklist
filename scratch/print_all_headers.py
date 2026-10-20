import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

py_script = '''
import openpyxl

for fname in ["TTM.xlsx", "TTTT.xlsx"]:
    path = f"/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/20.10/{fname}"
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))
    print(f"=== {fname} ===")
    print("Total rows:", len(rows))
    headers = [str(c or "").strip() for c in rows[0]]
    for idx, h in enumerate(headers):
        print(f"  Col {idx}: {h}")
    print("Sample row 1:")
    for idx, (h, val) in enumerate(zip(headers, rows[1])):
        if val is not None and str(val).strip() != "":
            print(f"    Col {idx} ({h}): {val}")
'''

stdin, stdout, stderr = ssh.exec_command(f"python3 -c '{py_script}'")
print(stdout.read().decode('utf-8', errors='replace'))
ssh.close()
