import paramiko
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

stdin, stdout, stderr = ssh.exec_command('find /mnt/qlgd-it -name "*TTM*" -mtime -2 2>/dev/null')
out = stdout.read()
sys.stdout.buffer.write(out)
ssh.close()
