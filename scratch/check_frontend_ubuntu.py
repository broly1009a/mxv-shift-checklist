import sys
import paramiko

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)
    
    # Check frontend directory and .next directory on Ubuntu
    stdin, stdout, stderr = client.exec_command('ls -la /opt/mxv-checklist/frontend/ && ls -la /opt/mxv-checklist/frontend/.next 2>/dev/null')
    print("=== FRONTEND DIR ON UBUNTU ===")
    print(stdout.read().decode('utf-8', errors='replace'))

    # Check pm2 show mxv-frontend
    stdin, stdout, stderr = client.exec_command('pm2 show mxv-frontend | grep -E "(script path|exec mode|status|restarts)"')
    print("=== PM2 SHOW MXV-FRONTEND ===")
    print(stdout.read().decode('utf-8', errors='replace'))

finally:
    client.close()
