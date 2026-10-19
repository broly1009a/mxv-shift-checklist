import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

def run_cmd(cmd, title):
    print(f'=== {title} ===')
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    print(out)
    if err:
        print('STDERR:', err)

run_cmd('sed -n "48370,48405p" ~/.pm2/logs/mxv-backend-out.log', 'BACKEND LINES 48370-48405')
run_cmd('sed -n "48835,48850p" ~/.pm2/logs/mxv-backend-out.log', 'BACKEND LINES 48835-48850')


ssh.close()
