import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

stdin, stdout, stderr = ssh.exec_command('grep -i -C 3 "MsApiAdapter" ~/.pm2/logs/mxv-backend-error*.log | tail -n 50')
out = stdout.read().decode('utf-8', errors='ignore')
print('ERROR LOGS:\n', out.encode('ascii', errors='replace').decode('ascii'))

stdin, stdout, stderr = ssh.exec_command('grep -i -C 2 "MsApiAdapter" ~/.pm2/logs/mxv-backend-out*.log | tail -n 50')
out2 = stdout.read().decode('utf-8', errors='ignore')
print('OUT LOGS:\n', out2.encode('ascii', errors='replace').decode('ascii'))

ssh.close()
