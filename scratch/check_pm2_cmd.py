import sys
import paramiko

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)
    
    # Check script args and current log of mxv-frontend
    stdin, stdout, stderr = client.exec_command('pm2 show mxv-frontend | grep -E "(script args|exec cwd)"')
    print("=== SCRIPT ARGS ===")
    print(stdout.read().decode('utf-8', errors='replace'))

    # Check last 20 lines of out log and err log
    stdin, stdout, stderr = client.exec_command('tail -n 25 /home/mxvadmin/.pm2/logs/mxv-frontend-out.log')
    print("=== FRONTEND OUT LOG ===")
    print(stdout.read().decode('utf-8', errors='replace'))

    stdin, stdout, stderr = client.exec_command('tail -n 25 /home/mxvadmin/.pm2/logs/mxv-frontend-error.log')
    print("=== FRONTEND ERR LOG ===")
    print(stdout.read().decode('utf-8', errors='replace'))

finally:
    client.close()
