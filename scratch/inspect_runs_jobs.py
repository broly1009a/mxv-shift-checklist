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

cmd = f'curl -s -X GET "http://127.0.0.1:3001/api/v1/trading-ops/console-summary?date=2026-10-19" -H "Authorization: Bearer {token}"'
stdin, stdout, stderr = client.exec_command(cmd)
res = json.loads(stdout.read().decode())
runs = res.get('runs', [])
print(f"Total runs: {len(runs)}")
for idx, r in enumerate(runs):
    print(f"Run {len(runs)-idx}: ID={r.get('id')}, time={r.get('time')}, createdAt={r.get('createdAt')}, status={r.get('status')}")

# Also check job details of these runs
for r in runs:
    job_id = r.get('id')
    job_cmd = f'curl -s -X GET "http://127.0.0.1:3001/api/v1/checklist-hub/jobs/{job_id}" -H "Authorization: Bearer {token}"'
    stdin, stdout, stderr = client.exec_command(job_cmd)
    try:
        j_data = json.loads(stdout.read().decode())
        j = j_data.get('data') or j_data
        print(f"Job {job_id} -> jobType: {j.get('jobType')}, name: {j.get('name')}, triggerType: {j.get('triggerType')}")
    except Exception as e:
        print(f"Job {job_id} -> error: {e}")

client.close()
