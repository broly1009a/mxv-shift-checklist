import paramiko
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print('Connecting to Ubuntu 10.0.0.26...')
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=30)
sftp = ssh.open_sftp()

local_base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
remote_base = '/opt/mxv-checklist'

files_to_sync = [
    # Backend
    'backend/src/modules/ingress/adapters/coreccp-api.adapter.ts',
    'backend/src/modules/trading-ops/services/ccp-eod.service.ts',
    'backend/src/modules/trading-ops/services/dsgd-before-eod.service.ts',
    'backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts',
    'backend/src/modules/trading-ops/workers/dsgd-before-eod-recon.worker.ts',
    # Frontend
    'frontend/src/app/trading-manager/components/shared/DsgdBeforeEodSection.tsx',
    'frontend/src/features/trading/components/CheckDsgdBeforeEodModal.tsx',
]

for rel_path in files_to_sync:
    local_path = os.path.join(local_base, rel_path.replace('/', os.sep))
    rem_path = f"{remote_base}/{rel_path}"
    print(f'Uploading {rel_path} -> {rem_path}...')
    rem_dir = os.path.dirname(rem_path)
    stdin, stdout, stderr = ssh.exec_command(f'mkdir -p "{rem_dir}"')
    stdout.channel.recv_exit_status()
    sftp.put(local_path, rem_path)
    print('  Uploaded successfully.')

sftp.close()

build_cmd = """
echo "=== 1. BUILDING BACKEND ==="
cd /opt/mxv-checklist/backend && npm run build
pm2 restart mxv-backend

echo "=== 2. BUILDING FRONTEND ==="
cd /opt/mxv-checklist/frontend && npm run build
pm2 restart mxv-frontend

echo "=== 3. PM2 STATUS ==="
pm2 status
"""

print('\nRunning build & restart on 10.0.0.26...')
stdin, stdout, stderr = ssh.exec_command(build_cmd)
for line in iter(stdout.readline, ""):
    print(line, end="")
err = stderr.read().decode('utf-8', errors='ignore')
if err:
    print('\nSTDERR / BUILD LOGS:\n', err)

ssh.close()
print('\nDeploy to Ubuntu completed successfully!')
