import sys
import paramiko

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

    stdin, stdout, stderr = client.exec_command('python3 -c "import pandas; print(pandas.__version__)"')
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    print("Pandas version on Ubuntu:", out if out else f"Not installed ({err})")

    stdin, stdout, stderr = client.exec_command('apt-cache policy python3-pandas')
    print("Apt package info:")
    print(stdout.read().decode('utf-8', errors='replace'))

finally:
    client.close()
