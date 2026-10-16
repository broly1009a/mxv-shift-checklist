import sys
import paramiko

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)
    
    # Check if BUILD_ID exists or what files exist in .next
    stdin, stdout, stderr = client.exec_command('ls -la /opt/mxv-checklist/frontend/.next/BUILD_ID')
    print("=== BUILD_ID CHECK ===")
    print(stdout.read().decode('utf-8', errors='replace'))
    print(stderr.read().decode('utf-8', errors='replace'))

    # Check git status or recent changes in /opt/mxv-checklist/frontend
    stdin, stdout, stderr = client.exec_command('cd /opt/mxv-checklist/frontend && ls -lt | head -n 10')
    print("=== RECENT FILES IN FRONTEND ===")
    print(stdout.read().decode('utf-8', errors='replace'))

finally:
    client.close()
