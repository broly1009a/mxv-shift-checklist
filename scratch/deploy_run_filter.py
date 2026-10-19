import paramiko
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=15)
sftp = ssh.open_sftp()

files_to_upload = [
    (
        r'c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-modular-refactor\backend\src\modules\trading-ops\services\qlgd-dashboard.service.ts',
        '/opt/mxv-checklist/backend/src/modules/trading-ops/services/qlgd-dashboard.service.ts'
    ),
    (
        r'c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-modular-refactor\backend\src\modules\trading-ops\controllers\trading-ops-misc.controller.ts',
        '/opt/mxv-checklist/backend/src/modules/trading-ops/controllers/trading-ops-misc.controller.ts'
    ),
    (
        r'c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-modular-refactor\frontend\src\features\trading\services\trading-ops.api.ts',
        '/opt/mxv-checklist/frontend/src/features/trading/services/trading-ops.api.ts'
    ),
    (
        r'c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-modular-refactor\frontend\src\app\trading-manager\components\QlgdExecutiveDashboard.tsx',
        '/opt/mxv-checklist/frontend/src/app/trading-manager/components/QlgdExecutiveDashboard.tsx'
    ),
]

print('=== UPLOADING FILES ===')
for local_path, remote_path in files_to_upload:
    print(f'Uploading {os.path.basename(local_path)} -> {remote_path}')
    sftp.put(local_path, remote_path)
sftp.close()

def run_remote(cmd, title):
    print(f'\n=== {title} ===')
    stdin, stdout, stderr = ssh.exec_command(cmd)
    while True:
        line = stdout.readline()
        if not line:
            break
        print(line.rstrip())
    err = stderr.read().decode('utf-8')
    if err:
        print('STDERR:', err)

run_remote('cd /opt/mxv-checklist/backend && npm run build', 'BUILDING BACKEND')
run_remote('pm2 restart mxv-backend', 'RESTARTING BACKEND PM2')
run_remote('cd /opt/mxv-checklist/frontend && npm run build', 'BUILDING FRONTEND')
run_remote('pm2 restart mxv-frontend', 'RESTARTING FRONTEND PM2')

ssh.close()
print('\n=== DEPLOYMENT COMPLETED ===')
