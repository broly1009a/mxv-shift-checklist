import paramiko
import os
import sys

files_to_sync = [
    'frontend/src/app/trading-manager/components/core-ccp/CcpLotStatisticsSection.tsx',
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

print('--- Building Frontend on Ubuntu ---')
stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/frontend && npm run build')
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
sys.stdout.buffer.write(out.encode('utf-8'))
sys.stdout.buffer.write(b'\n')
if err:
    sys.stdout.buffer.write(err.encode('utf-8'))
    sys.stdout.buffer.write(b'\n')

print('--- Restarting PM2 mxv-frontend ---')
stdin, stdout, stderr = ssh.exec_command('pm2 restart mxv-frontend')
res = stdout.read().decode('utf-8', errors='ignore')
sys.stdout.buffer.write(res.encode('utf-8'))
sys.stdout.buffer.write(b'\n')

# Check PM2 status
stdin, stdout, stderr = ssh.exec_command('pm2 status')
res2 = stdout.read().decode('utf-8', errors='ignore')
sys.stdout.buffer.write(res2.encode('utf-8'))
sys.stdout.buffer.write(b'\n')

ssh.close()
print('Deploy complete!')
