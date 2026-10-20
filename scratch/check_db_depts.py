import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

cmd = """mongosh mxv_shift_checklist --quiet --eval "print(JSON.stringify(db.users.findOne({username: 'staffqlgd'}))); print(JSON.stringify(db.users.findOne({username: 'quyetvx'})))" """
stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='ignore'))
ssh.close()

