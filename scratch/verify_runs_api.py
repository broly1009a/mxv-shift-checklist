import sys
import json
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

# Authenticate
login_cmd = 'curl -s -X POST http://127.0.0.1:3001/api/v1/auth/login -H "Content-Type: application/json" -d \'{"username":"admin","password":"Admin@MXV123"}\''
stdin_l, stdout_l, stderr_l = ssh.exec_command(login_cmd)
login_res = json.loads(stdout_l.read().decode('utf-8'))
token = login_res.get('access_token')

# Query live dashboard without jobId (Latest)
dash_cmd = f'curl -s "http://127.0.0.1:3001/api/v1/trading-ops/executive-dashboard?date=2026-10-19&scope=ALL" -H "Authorization: Bearer {token}"'
stdin, stdout, stderr = ssh.exec_command(dash_cmd)
data = json.loads(stdout.read().decode('utf-8'))

print('=== DASHBOARD RESULT (LATEST) ===')
print('sessionDate:', data.get('sessionDate'))
print('currentJobId:', data.get('currentJobId'))
print('isViewingHistorical:', data.get('isViewingHistorical'))
runs = data.get('runs', [])
print('Total runs found:', len(runs))
for r in runs[:5]:
    print(f"  Run ID={r.get('id')}, time={r.get('time')}, label={r.get('label')}, trigger={r.get('triggerLabel')}, status={r.get('status')}")

# Test querying a specific historical run if runs exist
if len(runs) > 1:
    hist_job = runs[1]
    hist_id = hist_job.get('id')
    print(f'\n=== QUERYING HISTORICAL RUN ({hist_id} - {hist_job.get("label")}) ===')
    hist_cmd = f'curl -s "http://127.0.0.1:3001/api/v1/trading-ops/executive-dashboard?date=2026-10-19&scope=ALL&jobId={hist_id}" -H "Authorization: Bearer {token}"'
    stdin_h, stdout_h, stderr_h = ssh.exec_command(hist_cmd)
    hist_data = json.loads(stdout_h.read().decode('utf-8'))
    print('isViewingHistorical:', hist_data.get('isViewingHistorical'))
    print('currentJobId:', hist_data.get('currentJobId'))
    print('latestMetrics:', json.dumps(hist_data.get('latestMetrics'), indent=2, ensure_ascii=False))

ssh.close()
