import paramiko
import os

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

files_to_sync = [
    'backend/src/shared/helpers/crypto.ts',
    'backend/src/modules/ingress/adapters/coreccp-api.adapter.ts',
    'backend/src/modules/ingress/adapters/ms-api.adapter.ts',
    'backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts',
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
print('All files synced!')

print('Building on Ubuntu...')
stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && npm run build')
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print('BUILD STDOUT:\n', out.encode('ascii', errors='replace').decode('ascii'))
print('BUILD STDERR:\n', err.encode('ascii', errors='replace').decode('ascii'))

print('Restarting PM2 mxv-backend...')
stdin, stdout, stderr = ssh.exec_command('pm2 restart mxv-backend')
print(stdout.read().decode('utf-8', errors='ignore'))

ssh.close()
