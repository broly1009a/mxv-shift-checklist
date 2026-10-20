import paramiko
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

login_cmd = 'curl -s -X POST http://127.0.0.1:3001/api/v1/auth/login -H "Content-Type: application/json" -d \'{"username":"admin","password":"Admin@MXV123"}\''
stdin, stdout, stderr = client.exec_command(login_cmd)
data = json.loads(stdout.read().decode())
token = data.get('accessToken') or data.get('access_token') or data.get('data', {}).get('accessToken')

cmd = f'curl -s -X POST http://127.0.0.1:3001/api/v1/trading-ops/sync-exchange-rates -H "Content-Type: application/json" -H "Authorization: Bearer {token}" -d "{{}}"'
stdin, stdout, stderr = client.exec_command(cmd)
print('Response from /api/v1/trading-ops/sync-exchange-rates:')
print(stdout.read().decode())
client.close()
