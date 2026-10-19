import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

remote_script = """
import openpyxl

f = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/19.10/TTM.xlsx'
wb = openpyxl.load_workbook(f, data_only=True, read_only=True)
ws = wb.active

accounts = []
for r in ws.iter_rows(min_row=2, values_only=True):
    if r and len(r) > 7 and r[7]:
        accounts.append(str(r[7]).strip())

print(f'Total rows in TTM.xlsx: {len(accounts)}')
ends_with_a = [a for a in accounts if a.upper().endswith('A')]
dash_a = [a for a in accounts if '-A' in a.upper()]
non_a = [a for a in accounts if not a.upper().endswith('A')]

print(f'Accounts ending with A: {len(ends_with_a)}')
print(f'Accounts with -A: {len(dash_a)}')
print(f'Accounts NOT ending with A: {len(non_a)}')

weird = [a for a in ends_with_a if not a.upper().endswith('-A')]
print(f'Ending with A but NOT ending with -A: {len(weird)}', weird[:10])
print('Sample non-A accounts:', non_a[:5])
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/check_ttm_acc.py', 'w') as sf:
    sf.write(remote_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('python3 /tmp/check_ttm_acc.py')
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()
