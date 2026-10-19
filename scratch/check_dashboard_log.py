import paramiko
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = 'grep -E "executive-dashboard|QlgdDashboard" /home/mxvadmin/.pm2/logs/mxv-backend-out.log | tail -n 30'
stdin, stdout, stderr = ssh.exec_command(cmd)
res = stdout.read().decode('utf-8')
sys.stdout.reconfigure(encoding='utf-8')
print("--- LOGS EXECUTIVE DASHBOARD ---")
print(res)

ssh.close()
