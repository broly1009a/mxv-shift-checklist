import sys
import json
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

# Authenticate
login_cmd = 'curl -s -X POST http://127.0.0.1:3001/api/v1/auth/login -H "Content-Type: application/json" -d \'{"username":"admin","password":"Admin@MXV123"}\''
_, stdout_l, _ = ssh.exec_command(login_cmd)
login_res = json.loads(stdout_l.read().decode('utf-8'))
token = login_res.get('access_token')

print('=== 1. TEST CONSOLE SUMMARY (LegacyReconSection) ===')
summary_cmd = f'curl -s "http://127.0.0.1:3001/api/v1/trading-ops/console-summary?date=2026-10-19" -H "Authorization: Bearer {token}"'
_, stdout_s, _ = ssh.exec_command(summary_cmd)
s_data = json.loads(stdout_s.read().decode('utf-8'))

runs = s_data.get('runs', [])
pre_eod_runs = s_data.get('preEodRuns', [])

print(f"Tổng số lượt trong runs (CHECK_KLGD): {len(runs)}")
for idx, r in enumerate(runs):
    run_num = len(runs) - idx
    print(f"  [KLGD Lượt #{run_num}] ID: {r.get('id')} | Time: {r.get('time')} | JobType: {r.get('jobType')} | Status: {r.get('status')}")

print(f"\nTổng số lượt trong preEodRuns (CHECK_PRE_EOD): {len(pre_eod_runs)}")
for idx, r in enumerate(pre_eod_runs):
    run_num = len(pre_eod_runs) - idx
    print(f"  [Pre-EOD Lượt #{run_num}] ID: {r.get('id')} | Time: {r.get('time')} | JobType: {r.get('jobType')} | Status: {r.get('status')}")

print('\n=== 2. TEST EXECUTIVE DASHBOARD ===')
dash_cmd = f'curl -s "http://127.0.0.1:3001/api/v1/trading-ops/executive-dashboard?date=2026-10-19&scope=ALL" -H "Authorization: Bearer {token}"'
_, stdout_d, _ = ssh.exec_command(dash_cmd)
d_data = json.loads(stdout_d.read().decode('utf-8'))
dash_runs = d_data.get('runs', [])
print(f"Tổng số lượt trong Executive Dashboard (CHECK_KLGD): {len(dash_runs)}")
for idx, r in enumerate(dash_runs):
    run_num = len(dash_runs) - idx
    print(f"  [Dash Lượt #{run_num}] ID: {r.get('id')} | Time: {r.get('time')} | Status: {r.get('status')}")

ssh.close()
