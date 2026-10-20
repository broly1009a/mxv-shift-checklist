import paramiko
import sys
import json
import time

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

print('Waiting 3s for mxv-backend to be ready...')
time.sleep(3)

login_cmd = 'curl -s -X POST http://127.0.0.1:3001/api/v1/auth/login -H "Content-Type: application/json" -d \'{"username":"admin","password":"Admin@MXV123"}\''
stdin_l, stdout_l, stderr_l = ssh.exec_command(login_cmd)
raw_login = stdout_l.read().decode('utf-8')
print('Raw login:', raw_login)
login_res = json.loads(raw_login)
token = login_res.get('access_token')

print('--- Verifying Live API on 10.0.0.26 for 2026-10-20 (refresh=true) ---')
cmd = f'curl -s "http://127.0.0.1:3001/api/v1/trading-ops/executive-dashboard?date=2026-10-20&scope=ALL&refresh=true" -H "Authorization: Bearer {token}"'
stdin, stdout, stderr = ssh.exec_command(cmd)
res = stdout.read().decode('utf-8')
try:
    data = json.loads(res)
    print('sessionDate:', data.get('sessionDate'))
    print('hasActualFiles:', data.get('hasActualFiles'))
    print('totals:', json.dumps(data.get('totals'), indent=2, ensure_ascii=False))
    items = data.get('items', [])
    print(f'Total items: {len(items)}')
    for it in items:
        if it.get('expectedPnL', 0) != 0 or it.get('realizedPnL', 0) != 0 or it.get('openPositions', 0) != 0:
            print(f"Symbol: {it['symbol']:<8} Name: {it['name']:<22} ExpectedPnL: {it['expectedPnL']:>18,d} VND | RealizedPnL: {it['realizedPnL']:>15,d} VND | OpenPos: {it['openPositions']:>6,d}")
except Exception as e:
    print('API Parse Error:', e, res[:500])

ssh.close()
