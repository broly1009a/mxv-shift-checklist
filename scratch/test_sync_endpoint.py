import paramiko
import json
import sys

# Set standard output encoding
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

login_cmd = 'curl -s -X POST http://127.0.0.1:3001/api/v1/auth/login -H "Content-Type: application/json" -d \'{"username":"admin","password":"Admin@MXV123"}\''
stdin, stdout, stderr = client.exec_command(login_cmd)
login_res = stdout.read().decode('utf-8')
data = json.loads(login_res)
token = data.get('accessToken') or data.get('access_token') or data.get('data', {}).get('accessToken')
print(f"Token obtained: {bool(token)}")

sync_cmd = f'curl -s -X POST http://127.0.0.1:3001/api/v1/ccp-statistics/lot-statistics/sync-exchange-rate -H "Content-Type: application/json" -H "Authorization: Bearer {token}" -d "{{}}"'
stdin, stdout, stderr = client.exec_command(sync_cmd)
res1 = stdout.read().decode('utf-8')
print("--- TEST /api/v1/ccp-statistics/lot-statistics/sync-exchange-rate ---")
print(res1)

sync_cmd2 = f'curl -s -X POST http://127.0.0.1:3001/api/v1/ccp-clearing/lot-statistics/sync-exchange-rate -H "Content-Type: application/json" -H "Authorization: Bearer {token}" -d "{{}}"'
stdin, stdout, stderr = client.exec_command(sync_cmd2)
res2 = stdout.read().decode('utf-8')
print("--- TEST /api/v1/ccp-clearing/lot-statistics/sync-exchange-rate ---")
print(res2)

client.close()
