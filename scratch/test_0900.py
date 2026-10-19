import sys, json, paramiko
sys.stdout.reconfigure(encoding='utf-8')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

login_cmd = 'curl -s -X POST http://127.0.0.1:3001/api/v1/auth/login -H "Content-Type: application/json" -d \'{"username":"admin","password":"Admin@MXV123"}\''
_, stdout_l, _ = ssh.exec_command(login_cmd)
token = json.loads(stdout_l.read().decode('utf-8'))['access_token']

hist_cmd = f'curl -s "http://127.0.0.1:3001/api/v1/trading-ops/executive-dashboard?date=2026-10-19&scope=ALL&jobId=6ad579d87940c0e955b5ce7c" -H "Authorization: Bearer {token}"'
_, stdout_h, _ = ssh.exec_command(hist_cmd)
hist_data = json.loads(stdout_h.read().decode('utf-8'))

print('=== HISTORICAL RUN 09:00:56 AM ===')
print('isViewingHistorical:', hist_data.get('isViewingHistorical'))
print('currentJobId:', hist_data.get('currentJobId'))
print('latestMetrics:', json.dumps(hist_data.get('latestMetrics'), indent=2, ensure_ascii=False))
print('milestones:', json.dumps(hist_data.get('milestones'), indent=2, ensure_ascii=False))

ssh.close()
