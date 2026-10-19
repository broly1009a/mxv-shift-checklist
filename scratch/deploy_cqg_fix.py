import paramiko
import os
import sys

files_to_sync = [
    'backend/src/modules/trading-ops/services/klgd-recon.service.ts',
    'backend/src/modules/trading-ops/services/pre-eod-recon.service.ts',
    'backend/src/modules/trading-ops/services/cqg-merger.service.ts',
    'backend/src/shared/helpers/file-path.helper.ts',
    'backend/src/legacy/archive/reconciliation/helpers/recon-number-parser.helper.ts',
]

base_local = r'c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-modular-refactor'
base_remote = '/opt/mxv-checklist'

print('Connecting to 10.0.0.26...')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

sftp = ssh.open_sftp()
for rel in files_to_sync:
    local_path = os.path.join(base_local, rel)
    remote_path = os.path.join(base_remote, rel).replace('\\', '/')
    print(f'Uploading {rel} -> {remote_path}...')
    sftp.put(local_path, remote_path)
sftp.close()
print('All files uploaded successfully!')

print('--- Building Backend on Ubuntu ---')
stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && npm run build')
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print('BACKEND STDOUT:', out)
if err:
    print('BACKEND STDERR:', err)

print('--- Restarting PM2 mxv-backend ---')
stdin, stdout, stderr = ssh.exec_command('pm2 restart mxv-backend')
print(stdout.read().decode('utf-8', errors='ignore'))

# Check PM2 status
stdin, stdout, stderr = ssh.exec_command('pm2 status')
print(stdout.read().decode('utf-8', errors='ignore'))

ssh.close()
print('Deploy complete!')
