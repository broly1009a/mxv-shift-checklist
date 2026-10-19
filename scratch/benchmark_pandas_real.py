import sys
import paramiko

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

    test_pd_code = """
import time, os
import pandas as pd

p = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/16.10/DSGD.xlsx'
t0 = time.time()
df = pd.read_excel(p)
dur = time.time() - t0

print(f"PANDAS READ SUCCESS: {len(df)} rows, {len(df.columns)} columns in {dur:.2f}s!")
print(f"Memory usage of DataFrame: {df.memory_usage(deep=True).sum() / (1024*1024):.2f} MB")
print("Top 3 accounts by trade count:")
print(df['Mã TKGD'].value_counts().head(3))
"""
    sftp = client.open_sftp()
    with sftp.file('/tmp/test_pandas_read.py', 'w') as f:
        f.write(test_pd_code)
    sftp.close()

    stdin, stdout, stderr = client.exec_command('python3 /tmp/test_pandas_read.py')
    print("PANDAS BENCHMARK ON REAL FILE:")
    print(stdout.read().decode('utf-8', errors='replace').strip())
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if err:
        print("ERR:", err)

finally:
    client.close()
