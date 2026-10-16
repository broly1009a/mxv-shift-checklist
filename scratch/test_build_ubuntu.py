import sys
import paramiko

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)
    
    print("=== TESTING NEXT BUILD ON UBUNTU ===")
    stdin, stdout, stderr = client.exec_command('cd /opt/mxv-checklist/frontend && npm run build')
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    print("STDOUT:\n", out)
    print("STDERR:\n", err)

finally:
    client.close()
