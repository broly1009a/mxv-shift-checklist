import paramiko
import os
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

files_to_sync = [
    'backend/src/modules/trading-ops/parsers/ms-excel.parser.ts',
    'backend/src/modules/trading-ops/parsers/ccp-excel.parser.ts',
]

base_local = r'c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-modular-refactor'
base_remote = '/opt/mxv-checklist'

print('Connecting to 10.0.0.26...')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

sftp = ssh.open_sftp()
for rel in files_to_sync:
    local_path = os.path.join(base_local, rel)
    remote_path = os.path.join(base_remote, rel).replace('\\', '/')
    print(f'Uploading {rel} -> {remote_path}...')
    sftp.put(local_path, remote_path)
sftp.close()
print('All files uploaded successfully!')

print('--- Building Backend on Ubuntu ---')
stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && npm run build')
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print('BACKEND STDOUT:', out[-500:] if len(out) > 500 else out)
if err and 'error' in err.lower():
    print('BACKEND STDERR:', err[:500])

print('--- Restarting PM2 mxv-backend ---')
stdin, stdout, stderr = ssh.exec_command('pm2 restart mxv-backend')
print(stdout.read().decode('utf-8', errors='ignore'))

# Query live API to verify results
login_cmd = 'curl -s -X POST http://127.0.0.1:3001/api/v1/auth/login -H "Content-Type: application/json" -d \'{"username":"admin","password":"Admin@MXV123"}\''
stdin_l, stdout_l, stderr_l = ssh.exec_command(login_cmd)
login_res = json.loads(stdout_l.read().decode('utf-8'))
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
    for it in items[:10]:
        print(f"Symbol: {it['symbol']:<8} Name: {it['name']:<20} ExpectedPnL: {it['expectedPnL']:>18,d} VND | RealizedPnL: {it['realizedPnL']:>15,d} VND | OpenPos: {it['openPositions']:>6,d}")
except Exception as e:
    print('API Parse Error:', e, res[:500])

ssh.close()
print('Done!')
