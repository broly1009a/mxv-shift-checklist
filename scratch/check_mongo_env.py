import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)
_, out, _ = ssh.exec_command('grep -i mongo /opt/mxv-checklist/backend/.env')
print(out.read().decode('utf-8'))
ssh.close()
