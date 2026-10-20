import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

py_script = '''
import openpyxl

path_ttm = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/20.10/TTM.xlsx"
wb = openpyxl.load_workbook(path_ttm, read_only=True, data_only=True)
sheet = wb.active
rows = list(sheet.iter_rows(values_only=True))

headers = [str(c or "").strip() for c in rows[0]]
print("Headers:", headers)

# Find ZWA rows
zwa_usd = 0
zwa_vnd = 0
count = 0
for r in rows[1:]:
    ma_hd = str(r[9] or "").strip()
    acc = str(r[7] or "").strip()
    if acc.upper().endswith("A"):
        continue
    if ma_hd.startswith("ZWA"):
        count += 1
        val_usd = float(r[17] or 0)
        val_vnd = float(r[18] or 0)
        zwa_usd += val_usd
        zwa_vnd += val_vnd

print(f"ZWA rows: {count}")
print(f"ZWA sum Col 17 (USD): {zwa_usd:,.2f}")
print(f"ZWA sum Col 18 (VND): {zwa_vnd:,.2f}")
'''

stdin, stdout, stderr = ssh.exec_command(f"python3 -c '{py_script}'")
print(stdout.read().decode('utf-8', errors='replace'))
ssh.close()
