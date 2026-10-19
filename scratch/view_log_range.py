import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

cmd = """
sed -n '54080,54160p' /home/mxvadmin/.pm2/logs/mxv-backend-out.log
"""
stdin, stdout, stderr = ssh.exec_command(cmd)
print("=== LOG FROM 54080 to 54160 ===")
print(stdout.read().decode('utf-8', errors='ignore'))

ssh.close()
