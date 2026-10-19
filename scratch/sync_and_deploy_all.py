import paramiko
import os

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

files_to_sync = [
    'backend/src/shared/domain-configs/coreccp-reports.config.ts',
    'backend/src/shared/domain-configs/coreex-reports.config.ts',
    'backend/src/shared/index.ts',
    'backend/src/modules/ingress/adapters/acm-sftp.adapter.ts',
    'backend/src/modules/ingress/ingress.service.ts',
    'backend/src/modules/ingress/scrapers/rpa-scraper.service.ts',
    'backend/src/modules/ingress/scrapers/ms-scraper.service.ts',
    'backend/src/modules/ingress/adapters/ms-api.adapter.ts',
    'backend/src/modules/ingress/adapters/coreccp-api.adapter.ts',
    'backend/src/modules/ingress/adapters/coreex-api.adapter.ts',
    'backend/src/modules/bot-engine/handlers/ccp-ce-download.handler.ts',
    'backend/src/modules/bot-engine/handlers/file-audit.handler.ts',
    'frontend/src/app/trading-manager/components/core-ccp/CcpCeBackupThongKeSection.tsx',
]

base_local = r'c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-cqg-download-investigation'
base_remote = '/opt/mxv-checklist'

sftp = ssh.open_sftp()
for rel in files_to_sync:
    local_path = os.path.join(base_local, rel)
    remote_path = os.path.join(base_remote, rel).replace('\\', '/')
    print(f'Uploading {rel} -> {remote_path}...')
    sftp.put(local_path, remote_path)
sftp.close()
print('All files synced!')

print('Building backend on Ubuntu...')
stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && npm run build')
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print('BACKEND BUILD STDOUT:\n', out)
if err:
    print('BACKEND BUILD STDERR:\n', err)

def safe_print(text):
    print(text.encode('ascii', errors='replace').decode('ascii'))

print('Restarting PM2 mxv-backend...')
stdin, stdout, stderr = ssh.exec_command('pm2 restart mxv-backend')
safe_print(stdout.read().decode('utf-8', errors='ignore'))

print('Building frontend on Ubuntu...')
stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/frontend && npm run build')
out_fe = stdout.read().decode('utf-8', errors='ignore')
err_fe = stderr.read().decode('utf-8', errors='ignore')
print('FRONTEND BUILD STDOUT:\n')
safe_print(out_fe)
if err_fe:
    print('FRONTEND BUILD STDERR:\n')
    safe_print(err_fe)

print('Restarting PM2 mxv-frontend...')
stdin, stdout, stderr = ssh.exec_command('pm2 restart mxv-frontend')
safe_print(stdout.read().decode('utf-8', errors='ignore'))

ssh.close()
print('Deployment complete!')
