import sys, json, paramiko
sys.stdout.reconfigure(encoding='utf-8')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

login_cmd = 'curl -s -X POST http://127.0.0.1:3001/api/v1/auth/login -H "Content-Type: application/json" -d \'{"username":"admin","password":"Admin@MXV123"}\''
_, stdout_l, _ = ssh.exec_command(login_cmd)
login_res = json.loads(stdout_l.read().decode('utf-8'))
token = login_res['access_token']

dash_cmd = f'curl -s "http://127.0.0.1:3001/api/v1/trading-ops/executive-dashboard?date=2026-10-19&scope=ALL" -H "Authorization: Bearer {token}"'
_, stdout_d, _ = ssh.exec_command(dash_cmd)
dash_data = json.loads(stdout_d.read().decode('utf-8'))

runs = dash_data.get('runs', [])
print(f"Tổng số lượt chạy trả về từ API: {len(runs)}")

# In từng lượt chạy
for idx, r in enumerate(runs):
    run_num = len(runs) - idx
    print(f"Lượt #{run_num} | ID: {r.get('id')} | Time: {r.get('time')} | Trigger: {r.get('triggerLabel')} | Status: {r.get('status')} | Discrepancy: {r.get('hasDiscrepancy')} | DSGD: {r.get('totalDSGD')} | Nano: {r.get('totalNano')}")

ssh.close()
