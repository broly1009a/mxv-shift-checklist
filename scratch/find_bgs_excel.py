import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

py_script = '''
import os, glob

dirs_to_search = [
    "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck",
    "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong",
    "/mnt/qlgd-it/Quanlygiaodich",
]

for d in dirs_to_search:
    found = glob.glob(f"{d}/**/Check BGS*.xls*", recursive=True)
    if found:
        print(f"Found in {d}:", found[:5])
'''

stdin, stdout, stderr = ssh.exec_command(f"python3 -c '{py_script}'")
print(stdout.read().decode('utf-8', errors='replace'))
ssh.close()
