import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26')

cmd = 'find /opt /mnt /home /var/www -name "*test-ccp*" 2>/dev/null'
stdin, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:\n", stdout.read().decode('utf-8', errors='ignore'))
ssh.close()
