import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.1.0.16', port=22, username='vncadmin', password='CiC=,!2o26', timeout=10)

cmd = r'''
sed -n '380,430p' /opt/mxv-tkgd/backend/src/modules/tkgd-automation/tkgd-automation.service.ts
'''
stdin, stdout, stderr = ssh.exec_command(cmd)
print("=== Output ===")
print(stdout.read().decode('utf-8'))

ssh.close()
