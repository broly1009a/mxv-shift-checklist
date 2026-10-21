import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26')

remote_code = '''
import pandas as pd
import json

fr_path = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026/21.10/FR.xlsx"
dsgd_path = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/21.10/DSGD.xlsx"

df_fr = pd.read_excel(fr_path)
df_dsgd = pd.read_excel(dsgd_path)

print("=== 1. TIM TRONG FR.xlsx (CQG) ===")
m_fr = df_fr.astype(str).apply(lambda col: col.str.contains('080C1638824', case=False, na=False)).any(axis=1)
rows_fr = df_fr[m_fr]
print("So lenh cua TK 080C1638824 trong FR:", len(rows_fr))
for idx, r in rows_fr.iterrows():
    print(r.dropna().to_dict())

print("\\n=== 2. TIM TRONG DSGD.xlsx (MS) ===")
m_dsgd = df_dsgd.astype(str).apply(lambda col: col.str.contains('080C1638824', case=False, na=False)).any(axis=1)
rows_dsgd = df_dsgd[m_dsgd]
print("So lenh cua TK 080C1638824 trong DSGD:", len(rows_dsgd))
for idx, r in rows_dsgd.iterrows():
    print(r.dropna().to_dict())

print("\\n=== 3. TIM MA LENH 162091632 TRONG DSGD ===")
m_order = df_dsgd.astype(str).apply(lambda col: col.str.contains('162091632', case=False, na=False)).any(axis=1)
rows_order = df_dsgd[m_order]
print("So lenh co ma 162091632 trong DSGD:", len(rows_order))
for idx, r in rows_order.iterrows():
    print(r.dropna().to_dict())
'''

sftp = ssh.open_sftp()
with sftp.file('/tmp/check_order2.py', 'w') as f:
    f.write(remote_code)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('python3 /tmp/check_order2.py')
print(stdout.read().decode('utf-8'))
ssh.close()
