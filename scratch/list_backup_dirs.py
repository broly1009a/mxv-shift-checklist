import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

py_script = '''
import os, glob

base = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong"
found = glob.glob(f"{base}/*Backup*")
print("Backup folders:")
for f in sorted(found):
    print(" ", f)
'''

stdin, stdout, stderr = ssh.exec_command(f"python3 -c '{py_script}'")
print(stdout.read().decode('utf-8'))
ssh.close()
