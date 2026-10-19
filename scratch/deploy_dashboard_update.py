import paramiko
import os
import sys

files_to_sync = [
    'backend/src/modules/trading-ops/services/qlgd-dashboard.service.ts',
    'frontend/src/app/trading-manager/components/QlgdExecutiveDashboard.tsx',
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
print('BACKEND STDOUT:', out[:500] if len(out) > 500 else out)
if err and 'error' in err.lower():
    print('BACKEND STDERR:', err[:500])

print('--- Building Frontend on Ubuntu ---')
stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/frontend && npm run build')
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print('FRONTEND STDOUT:', out[-500:] if len(out) > 500 else out)
if err and 'error' in err.lower():
    print('FRONTEND STDERR:', err[:500])

print('--- Restarting PM2 services ---')
stdin, stdout, stderr = ssh.exec_command('pm2 restart mxv-backend mxv-frontend')
print(stdout.read().decode('utf-8', errors='ignore'))

ssh.close()
print('Deploy complete!')
