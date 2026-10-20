import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)
cmd = '''
curl -s -o /dev/null -w "dashboard: HTTP %{http_code}\n" http://localhost:3000/trading-manager/dashboard
curl -s -o /dev/null -w "settings/ms-cqg: HTTP %{http_code}\n" http://localhost:3000/trading-manager/settings/ms-cqg
curl -s -o /dev/null -w "statistics/ms: HTTP %{http_code}\n" http://localhost:3000/trading-manager/statistics/ms
curl -s -o /dev/null -w "backup: HTTP %{http_code}\n" http://localhost:3000/trading-manager/backup
curl -s -o /dev/null -w "backend api departments: HTTP %{http_code}\n" http://localhost:3001/api/v1/departments
'''
stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='ignore'))
ssh.close()
