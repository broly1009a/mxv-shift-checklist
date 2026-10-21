import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26')

cmd = """
grep -E "CheckDSGDBeforeCCP|dsgd-before-eod|CheckDSGDBeforeEOD|DSGD CCP" /home/mxvadmin/.pm2/logs/mxv-backend-out.log | tail -n 50
"""
stdin, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:\n", stdout.read().decode('utf-8', errors='ignore'))
ssh.close()
