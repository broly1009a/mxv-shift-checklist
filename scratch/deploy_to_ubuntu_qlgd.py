import paramiko
import os
import sys
import hashlib

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Target files from recent changes
files_to_sync = [
    # Documentation
    'CHANGELOG_AI.md',

    # Backend parsers & configs
    'backend/src/modules/trading-ops/parsers/index.ts',
    'backend/src/modules/trading-ops/parsers/symbol-normalizer.helper.ts',
    'backend/src/modules/trading-ops/parsers/tt-symbol-mapping.config.ts',
    'backend/src/modules/trading-ops/parsers/tt-trades-csv.parser.ts',
    'backend/src/modules/trading-ops/services/ccp-adhoc-statistics.service.ts',
    'backend/src/modules/trading-ops/services/dsgd-before-eod.service.ts',
    'backend/src/modules/trading-ops/services/ccp-eod.service.ts',
    'backend/src/modules/trading-ops/services/qlgd-dashboard.service.ts',
    'backend/src/modules/trading-ops/services/klgd-recon.service.ts',
    'backend/src/modules/trading-ops/services/recon-console-summary.service.ts',
    'backend/src/modules/trading-ops/services/ccp-accumulator.service.ts',
    'backend/src/modules/trading-ops/controllers/ccp-recon.controller.ts',
    'backend/src/modules/trading-ops/controllers/trading-ops-misc.controller.ts',
    'backend/src/modules/trading-ops/trading-ops.module.ts',
    'backend/src/shared/contracts/ingress-result.contract.ts',
    'backend/src/shared/domain-configs/coreccp-reports.config.ts',
    'backend/src/shared/domain-configs/coreex-reports.config.ts',
    'backend/src/shared/domain-configs/ms-reports.config.ts',
    'backend/src/shared/helpers/file-path.helper.ts',
    'backend/src/modules/ingress/adapters/coreccp-api.adapter.ts',

    # Frontend
    'frontend/src/app/globals.css',
    'frontend/src/components/Sidebar.tsx',
    'frontend/src/services/api/ccp-clearing.api.ts',
    'frontend/src/services/api/endpoints.ts',
    'frontend/src/services/api/trading-ops.api.ts',
    'frontend/src/app/trading-manager/components/QlgdExecutiveDashboard.tsx',
    'frontend/src/app/trading-manager/components/core-ccp/CcpLotStatisticsSection.tsx',
    'frontend/src/app/trading-manager/components/core-ccp/CcpCeEodReconSection.tsx',
    'frontend/src/app/trading-manager/components/core-ccp/CcpCeBackupThongKeSection.tsx',
    'frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyCqgSyncSection.tsx',
    'frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyReconSection.tsx',
    'frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx',
    'frontend/src/app/trading-manager/components/shared/DsgdBeforeEodSection.tsx',
    'frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx',
]

base_local = r'c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-cqg-download-investigation'
base_remote = '/opt/mxv-checklist'

print('=== 1. KẾT NỐI SSH TỚI UBUNTU 10.0.0.26 ===')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

print('\n=== 2. KIỂM TRA VÀ TẢI FILE LÊN /opt/mxv-checklist ===')
sftp = ssh.open_sftp()

def ensure_remote_dir(remote_dir_path):
    dirs = []
    p = remote_dir_path
    while p and p != '/' and p != '':
        dirs.append(p)
        p = os.path.dirname(p).replace('\\', '/')
    dirs.reverse()
    for d in dirs:
        try:
            sftp.stat(d)
        except IOError:
            try:
                sftp.mkdir(d)
                print(f'  [+] Created remote dir: {d}')
            except Exception as e:
                pass

uploaded_count = 0
for rel in files_to_sync:
    local_path = os.path.join(base_local, rel)
    remote_path = os.path.join(base_remote, rel).replace('\\', '/')
    if not os.path.exists(local_path):
        print(f'[-] Local path not found: {local_path}')
        continue
    remote_dir = os.path.dirname(remote_path).replace('\\', '/')
    ensure_remote_dir(remote_dir)

    needs_upload = True
    try:
        r_stat = sftp.stat(remote_path)
        l_stat = os.stat(local_path)
        if r_stat.st_size == l_stat.st_size:
            with open(local_path, 'rb') as f:
                l_md5 = hashlib.md5(f.read()).hexdigest()
            with sftp.open(remote_path, 'rb') as rf:
                r_md5 = hashlib.md5(rf.read()).hexdigest()
            if l_md5 == r_md5:
                needs_upload = False
    except IOError:
        needs_upload = True

    if needs_upload:
        print(f'[+] Uploading: {rel}')
        sftp.put(local_path, remote_path)
        uploaded_count += 1
    else:
        print(f'[=] Unchanged: {rel}')

sftp.close()
print(f'-> Đã hoàn thành tải lên {uploaded_count} files thay đổi / mới!')

env_prefix = 'export PATH=$PATH:/usr/local/bin:/usr/bin:~/.nvm/versions/node/$(ls ~/.nvm/versions/node 2>/dev/null | tail -n 1)/bin; '

print('\n=== 3. BUILD BACKEND TRÊN UBUNTU ===')
stdin, stdout, stderr = ssh.exec_command(f'{env_prefix} cd /opt/mxv-checklist/backend && npm run build')
out_be = stdout.read().decode('utf-8', errors='replace')
err_be = stderr.read().decode('utf-8', errors='replace')
print(out_be)
if err_be:
    print('BACKEND BUILD STDERR:\n', err_be)

print('\n=== 4. RESTART PM2 MXV-BACKEND ===')
stdin, stdout, stderr = ssh.exec_command(f'{env_prefix} pm2 restart mxv-backend')
print(stdout.read().decode('utf-8', errors='replace'))

print('\n=== 5. BUILD FRONTEND TRÊN UBUNTU ===')
stdin, stdout, stderr = ssh.exec_command(f'{env_prefix} cd /opt/mxv-checklist/frontend && npm run build')
out_fe = stdout.read().decode('utf-8', errors='replace')
err_fe = stderr.read().decode('utf-8', errors='replace')
print(out_fe)
if err_fe:
    print('FRONTEND BUILD STDERR:\n', err_fe)

print('\n=== 6. RESTART PM2 MXV-FRONTEND ===')
stdin, stdout, stderr = ssh.exec_command(f'{env_prefix} pm2 restart mxv-frontend')
print(stdout.read().decode('utf-8', errors='replace'))

print('\n=== 7. KIỂM TRA TRẠNG THÁI PM2 ===')
stdin, stdout, stderr = ssh.exec_command(f'{env_prefix} pm2 status')
print(stdout.read().decode('utf-8', errors='replace'))

ssh.close()
print('\n=== HOÀN TẤT ĐỒNG BỘ VÀ TRIỂN KHAI LÊN UBUNTU 10.0.0.26 THÀNH CÔNG! ===')
