import sys, json, paramiko
sys.stdout.reconfigure(encoding='utf-8')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

login_cmd = 'curl -s -X POST http://127.0.0.1:3001/api/v1/auth/login -H "Content-Type: application/json" -d \'{"username":"admin","password":"Admin@MXV123"}\''
_, stdout_l, _ = ssh.exec_command(login_cmd)
token = json.loads(stdout_l.read().decode('utf-8'))['access_token']

failed_jobs = [
  ("Lượt #14", "6ad590adc765f06c8bbf8248"),
  ("Lượt #11", "6ad5876d06b3c6b7bf78d316"),
  ("Lượt #7",  "6ad575a17940c0e955b5ce73"),
  ("Lượt #4",  "6ad56f147940c0e955b5ce6c"),
  ("Lượt #1",  "6ad550067940c0e955b5ce63"),
]

for label, jid in failed_jobs:
    cmd = f'curl -s "http://127.0.0.1:3001/api/v1/bot-engine/jobs/{jid}" -H "Authorization: Bearer {token}"'
    _, stdout_j, _ = ssh.exec_command(cmd)
    raw = stdout_j.read().decode('utf-8')
    try:
        data = json.loads(raw)
        print(f"=== {label} (ID: {jid}) ===")
        print("Status:", data.get('status'))
        print("Error:", data.get('error'))
        logs = data.get('logs', [])
        print("Last 3 logs:")
        for l in logs[-3:]:
            print("  ", l)
        print("-" * 50)
    except Exception as e:
        print(f"Lỗi parse {label}: {e}, raw: {raw[:100]}")

ssh.close()
