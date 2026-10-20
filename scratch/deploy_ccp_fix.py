import paramiko
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=30)
sftp = ssh.open_sftp()

local_base = r'c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-modular-refactor'

files_to_sync = [
    # Backend helpers
    ('backend/src/modules/trading-ops/helpers/ccp-classifier.helper.ts',
     '/opt/mxv-checklist/backend/src/modules/trading-ops/helpers/ccp-classifier.helper.ts'),
    ('backend/src/modules/trading-ops/helpers/ccp-accumulator.helper.ts',
     '/opt/mxv-checklist/backend/src/modules/trading-ops/helpers/ccp-accumulator.helper.ts'),
    # Backend services
    ('backend/src/modules/trading-ops/services/ccp-lot-statistics.service.ts',
     '/opt/mxv-checklist/backend/src/modules/trading-ops/services/ccp-lot-statistics.service.ts'),
    ('backend/src/modules/trading-ops/services/ccp-statistics.service.ts',
     '/opt/mxv-checklist/backend/src/modules/trading-ops/services/ccp-statistics.service.ts'),
    # Backend controller & module
    ('backend/src/modules/trading-ops/controllers/ccp-recon.controller.ts',
     '/opt/mxv-checklist/backend/src/modules/trading-ops/controllers/ccp-recon.controller.ts'),
    ('backend/src/modules/trading-ops/trading-ops.module.ts',
     '/opt/mxv-checklist/backend/src/modules/trading-ops/trading-ops.module.ts'),
    # Frontend component
    ('frontend/src/app/trading-manager/components/core-ccp/CcpLotStatisticsSection.tsx',
     '/opt/mxv-checklist/frontend/src/app/trading-manager/components/core-ccp/CcpLotStatisticsSection.tsx'),
]

for rel_src, rem_dest in files_to_sync:
    local_path = os.path.join(local_base, rel_src.replace('/', os.sep))
    print(f'Uploading {rel_src} -> {rem_dest}...')
    rem_dir = os.path.dirname(rem_dest)
    stdin, stdout, stderr = ssh.exec_command(f'mkdir -p "{rem_dir}"')
    stdout.channel.recv_exit_status()
    sftp.put(local_path, rem_dest)
    print('  Uploaded successfully.')

sftp.close()

build_cmd = """
cd /opt/mxv-checklist/backend && npm run build
pm2 restart mxv-backend

cd /opt/mxv-checklist/frontend && npm run build
pm2 restart mxv-frontend
pm2 status
"""

print('Running build & restart on 10.0.0.26...')
stdin, stdout, stderr = ssh.exec_command(build_cmd)
for line in iter(stdout.readline, ""):
    print(line, end="")
err = stderr.read().decode('utf-8', errors='ignore')
if err:
    print('STDERR:', err)

ssh.close()
print('Deploy completed successfully!')
