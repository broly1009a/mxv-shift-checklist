import sys
import time
import paramiko

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)
    
    print("=== RESTARTING MXV-FRONTEND ===")
    stdin, stdout, stderr = client.exec_command('pm2 restart mxv-frontend')
    print(stdout.read().decode('utf-8', errors='replace'))
    time.sleep(3)

    print("=== VERIFYING PORT 3000 AND HTTP RESPONSE ===")
    stdin, stdout, stderr = client.exec_command('curl -I -s http://127.0.0.1:3000/trading-manager/ms-cqg')
    print(stdout.read().decode('utf-8', errors='replace'))

    print("=== PM2 STATUS ===")
    stdin, stdout, stderr = client.exec_command('pm2 list')
    print(stdout.read().decode('utf-8', errors='replace'))

finally:
    client.close()
