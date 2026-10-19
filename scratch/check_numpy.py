import sys
import paramiko

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

    stdin, stdout, stderr = client.exec_command('python3 -c "import numpy; print(numpy.__version__, numpy.__file__)"')
    print("Numpy:", stdout.read().decode('utf-8', errors='replace').strip())

    # If pip has numpy 2.x in /usr/local or ~/.local, it conflicts with system pandas.
    # Let's check pip list
    stdin, stdout, stderr = client.exec_command('pip list 2>&1 | grep -E "numpy|pandas"')
    print("Pip list:", stdout.read().decode('utf-8', errors='replace').strip())

finally:
    client.close()
