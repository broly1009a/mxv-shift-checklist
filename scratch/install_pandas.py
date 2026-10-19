import sys
import paramiko

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

    print("=== INSTALLING PYTHON3-PANDAS VIA APT ON UBUNTU ===")
    stdin, stdout, stderr = client.exec_command('echo "MxV!,#2o26" | sudo -S apt-get update && echo "MxV!,#2o26" | sudo -S apt-get install -y python3-pandas')
    for line in stdout:
        if any(k in line for k in ['Get:', 'Setting up', 'Unpacking', 'Processing', 'Fetched', 'done']):
            print(line.strip())

    stdin, stdout, stderr = client.exec_command('python3 -c "import pandas as pd; print(\'Pandas version successfully installed:\', pd.__version__)"')
    print("\nVERIFICATION:", stdout.read().decode('utf-8', errors='replace').strip())

finally:
    client.close()
