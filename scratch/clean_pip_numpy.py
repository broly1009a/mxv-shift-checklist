import sys
import paramiko

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

    # 1. Clean the user site-packages completely
    stdin, stdout, stderr = client.exec_command('rm -rf /home/mxvadmin/.local/lib/python3.12/site-packages/*')
    stdout.read()

    # 2. Re-install clean official Ubuntu python3-pandas & python3-numpy
    stdin, stdout, stderr = client.exec_command('echo "MxV!,#2o26" | sudo -S apt-get install --reinstall -y python3-pandas python3-numpy')
    stdout.read()

    # 3. Test import
    stdin, stdout, stderr = client.exec_command('python3 -c "import numpy as np; import pandas as pd; print(\'PANDAS & NUMPY 100% OPERATIONAL!\', np.__version__, pd.__version__)"')
    print("OUTPUT:", stdout.read().decode('utf-8', errors='replace').strip())
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if err:
        print("ERR:", err)

finally:
    client.close()
