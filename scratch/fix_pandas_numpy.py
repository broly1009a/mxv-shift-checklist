import sys
import paramiko

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

    # Let's upgrade pandas in ~/.local so it works with numpy 2.x
    stdin, stdout, stderr = client.exec_command('pip install "pandas>=2.2.2" --break-system-packages')
    print("Pip install pandas:")
    for line in stdout:
        print(line.strip())

    stdin, stdout, stderr = client.exec_command('python3 -c "import pandas as pd; print(\'PANDAS OK! Version:\', pd.__version__)"')
    print("VERIFICATION:", stdout.read().decode('utf-8', errors='replace').strip())
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if err:
        print("ERR:", err)

finally:
    client.close()
