import paramiko
import os
import sys

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)
    print("Connected to 10.0.0.26 successfully.")
except Exception as e:
    print(f"Connection failed: {e}")
    sys.exit(1)

files_to_sync = [
    'backend/src/modules/trading-ops/controllers/klgd-recon.controller.ts',
    'backend/src/modules/ingress/adapters/coreccp-api.adapter.ts',
    'backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts',
    'backend/src/modules/trading-ops/workers/klgd-recon.worker.ts',
]

base_local = r'c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-modular-refactor'
base_remote = '/opt/mxv-checklist'

sftp = ssh.open_sftp()
for rel in files_to_sync:
    local_path = os.path.join(base_local, rel)
    remote_path = os.path.join(base_remote, rel).replace('\\', '/')
    print(f'Uploading {rel} -> {remote_path}...')
    sftp.put(local_path, remote_path)
sftp.close()
print('All 4 files synced successfully!')

print('Building backend on Ubuntu...')
stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && npm run build')
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print('BUILD STDOUT:\n', out.encode('ascii', errors='replace').decode('ascii'))
print('BUILD STDERR:\n', err.encode('ascii', errors='replace').decode('ascii'))

print('Restarting PM2 mxv-backend...')
stdin, stdout, stderr = ssh.exec_command('pm2 restart mxv-backend')
pm2_out = stdout.read().decode('utf-8', errors='ignore')
print(pm2_out.encode('ascii', errors='replace').decode('ascii'))

ssh.close()
print('Deployment complete!')
