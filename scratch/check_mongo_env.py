import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

stdin, stdout, stderr = ssh.exec_command("cat /opt/mxv-checklist/backend/.env | grep -i mongo")
print(stdout.read().decode('utf-8'))
ssh.close()
