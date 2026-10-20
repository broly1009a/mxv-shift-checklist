import sys
import json
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

# Authenticate first
login_cmd = 'curl -s -X POST http://127.0.0.1:3001/api/v1/auth/login -H "Content-Type: application/json" -d \'{"username":"admin","password":"Admin@MXV123"}\''
stdin_l, stdout_l, stderr_l = ssh.exec_command(login_cmd)
login_res = json.loads(stdout_l.read().decode('utf-8'))
token = login_res.get('access_token')

for target_date in ['2026-10-20', '2026-10-19']:
    print(f'================ DATE: {target_date} ================')
    cmd = f'curl -s "http://127.0.0.1:3001/api/v1/trading-ops/executive-dashboard?date={target_date}&scope=ALL" -H "Authorization: Bearer {token}"'
    stdin, stdout, stderr = ssh.exec_command(cmd)
    res = stdout.read().decode('utf-8')
    try:
        data = json.loads(res)
        print('sessionDate:', data.get('sessionDate'))
        print('hasActualFiles:', data.get('hasActualFiles'))
        print('dataSource:', data.get('dataSource'))
        print('totals:', json.dumps(data.get('totals'), indent=2, ensure_ascii=False))
        items = data.get('items', [])
        print(f'Total items: {len(items)}')
        for it in items:
            if it.get('expectedPnL', 0) != 0 or it.get('realizedPnL', 0) != 0 or it.get('openPositions', 0) != 0:
                print(f"Symbol: {it['symbol']:<8} Name: {it['name']:<20} ExpectedPnL: {it['expectedPnL']:>15,d} RealizedPnL: {it['realizedPnL']:>15,d} OpenPos: {it['openPositions']:>6,d}")
    except Exception as e:
        print('Error:', e, res[:500])

ssh.close()
