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
print('Token acquired:', bool(token))

dashboard_cmd = f'curl -s "http://127.0.0.1:3001/api/v1/trading-ops/executive-dashboard?date=2026-10-19&scope=ALL" -H "Authorization: Bearer {token}"'
stdin, stdout, stderr = ssh.exec_command(dashboard_cmd)
res = stdout.read().decode('utf-8')
try:
    data = json.loads(res)
except Exception as e:
    print('JSON error:', e)
    data = {}



print('=== DASHBOARD RESPONSE SUMMARY ===')
print('sessionDate:', data.get('sessionDate'))
print('hasActualFiles:', data.get('hasActualFiles'))
print('dataSource:', data.get('dataSource'))
print('latestMetrics:', json.dumps(data.get('latestMetrics'), indent=2, ensure_ascii=False))
print('milestones:', json.dumps(data.get('milestones'), indent=2, ensure_ascii=False))
print('bgsMessages:', json.dumps(data.get('bgsMessages'), indent=2, ensure_ascii=False))
print('qlgdMessages:', json.dumps(data.get('qlgdMessages'), indent=2, ensure_ascii=False))
print('totals:', json.dumps(data.get('totals'), indent=2, ensure_ascii=False))
print('Number of items:', len(data.get('items', [])))
if data.get('items'):
    print('Sample items (top 5):', json.dumps(data.get('items')[:5], indent=2, ensure_ascii=False))

# Check what actual files exist in the two directories
cmd_files = '''
echo "--- TradingCheck Futures 19.10 ---"
ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/19.10" 2>/dev/null || echo "Not found"
echo "--- TradingCheck CCP Futures 19.10 ---"
ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/CCP/Futures/2026/T10.2026/19.10" 2>/dev/null || echo "Not found"
echo "--- Backup MS Futures 19.10 ---"
ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026/19.10" 2>/dev/null || echo "Not found"
echo "--- Backup CCP Futures 19.10 ---"
ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/19.10" 2>/dev/null || echo "Not found"
'''
stdin2, stdout2, stderr2 = ssh.exec_command(cmd_files)
print('=== DIRECTORY FILE LISTING ===')
print(stdout2.read().decode('utf-8', errors='replace'))

ssh.close()
