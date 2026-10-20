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

    # Backend
    'backend/package.json',
    'backend/src/modules/activity-log/activity-log.controller.ts',
    'backend/src/modules/bot-engine/handlers/ccp-ce-download.handler.ts',
    'backend/src/modules/bot-engine/handlers/file-audit.handler.ts',
    'backend/src/modules/bot-engine/scheduler.service.ts',
    'backend/src/modules/bot-engine/helpers/bot-path.helper.ts',
    'backend/src/shared/helpers/file-path.helper.ts',
    'backend/src/modules/ingress/adapters/acm-sftp.adapter.ts',
    'backend/src/modules/ingress/adapters/coreccp-api.adapter.ts',
    'backend/src/modules/ingress/adapters/coreex-api.adapter.ts',
    'backend/src/modules/ingress/adapters/ms-api.adapter.ts',
    'backend/src/modules/ingress/scrapers/ccp-ce-scraper.service.ts',
    'backend/src/modules/ingress/scrapers/rpa-scraper.service.ts',
    'backend/src/modules/trading-ops/controllers/ccp-recon.controller.ts',
    'backend/src/modules/trading-ops/controllers/trading-ops-misc.controller.ts',
    'backend/src/modules/trading-ops/services/klgd-recon.service.ts',
    'backend/src/modules/trading-ops/services/qlgd-dashboard.service.ts',
    'backend/src/modules/trading-ops/services/recon-console-summary.service.ts',
    'backend/src/modules/trading-ops/services/ccp-accumulator.service.ts',
    'backend/src/shared/domain-configs/coreex-reports.config.ts',
    'backend/src/shared/domain-configs/ms-reports.config.ts',

    # Frontend - Navigation & Roles
    'frontend/src/components/Sidebar.tsx',
    'frontend/src/hooks/usePermissions.ts',
    'frontend/src/config/storage-path.config.ts',
    'frontend/src/components/admin/SmartPathInput.tsx',
    'frontend/src/utils/activity-log-mapper.ts',
    'frontend/src/services/api/endpoints.ts',
    'frontend/src/services/api/trading-ops.api.ts',

    # Frontend - Trading Manager components
    'frontend/src/app/admin/activity-logs/page.tsx',
    'frontend/src/app/trading-manager-v2/page.tsx',
    'frontend/src/app/trading-manager/components/core-ccp/CcpCeEodReconSection.tsx',
    'frontend/src/app/trading-manager/components/core-ccp/CcpCeBackupThongKeSection.tsx',
    'frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyCqgSyncSection.tsx',
    'frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyReconSection.tsx',
    'frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx',
    'frontend/src/app/trading-manager/components/shared/DsgdBeforeEodSection.tsx',
    'frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx',
    'frontend/src/features/trading/components/CheckDsgdBeforeEodModal.tsx',
    'frontend/src/features/trading/index.ts',
    'frontend/src/features/trading/services/trading-ops.api.ts',

    # Frontend - Standalone QLGD Pages
    'frontend/src/app/trading-manager/backup/page.tsx',
    'frontend/src/app/trading-manager/job-queue/page.tsx',
    'frontend/src/app/trading-manager/logs/page.tsx',
    'frontend/src/app/trading-manager/settings/page.tsx',
    'frontend/src/app/trading-manager/settings/ms-cqg/page.tsx',
    'frontend/src/app/trading-manager/settings/legacy-paths/page.tsx',
    'frontend/src/app/trading-manager/settings/ccp-ce/page.tsx',
    'frontend/src/app/trading-manager/settings/modern-paths/page.tsx',
    'frontend/src/app/trading-manager/statistics/page.tsx',
    'frontend/src/app/trading-manager/statistics/ms/page.tsx',
    'frontend/src/app/trading-manager/statistics/ccp/page.tsx',
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

    # Check if remote file exists and compare size
    needs_upload = True
    try:
        r_stat = sftp.stat(remote_path)
        l_stat = os.stat(local_path)
        # If size differs or local is newer, upload
        if r_stat.st_size == l_stat.st_size:
            # Let's do md5 check for exact comparison
            with open(local_path, 'rb') as f:
                l_md5 = hashlib.md5(f.read()).hexdigest()
            # Read remote file md5 via ssh command or sftp read
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

print('\n=== 3. BUILD BACKEND TRÊN UBUNTU ===')
stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && npm run build')
out_be = stdout.read().decode('utf-8', errors='ignore')
err_be = stderr.read().decode('utf-8', errors='ignore')
print(out_be)
if err_be:
    print('BACKEND BUILD STDERR:\n', err_be)

print('\n=== 4. RESTART PM2 MXV-BACKEND ===')
stdin, stdout, stderr = ssh.exec_command('pm2 restart mxv-backend')
print(stdout.read().decode('utf-8', errors='ignore'))

print('\n=== 5. BUILD FRONTEND TRÊN UBUNTU ===')
stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/frontend && npm run build')
out_fe = stdout.read().decode('utf-8', errors='ignore')
err_fe = stderr.read().decode('utf-8', errors='ignore')
print(out_fe)
if err_fe:
    print('FRONTEND BUILD STDERR:\n', err_fe)

print('\n=== 6. RESTART PM2 MXV-FRONTEND ===')
stdin, stdout, stderr = ssh.exec_command('pm2 restart mxv-frontend')
print(stdout.read().decode('utf-8', errors='ignore'))

print('\n=== 7. KIỂM TRA TRẠNG THÁI PM2 VÀ LOGS ===')
stdin, stdout, stderr = ssh.exec_command('pm2 status')
print(stdout.read().decode('utf-8', errors='ignore'))

stdin, stdout, stderr = ssh.exec_command('pm2 logs --lines 15 --nostream')
print(stdout.read().decode('utf-8', errors='ignore'))

ssh.close()
print('\n=== HOÀN TẤT ĐỒNG BỘ VÀ TRIỂN KHAI LÊN UBUNTU 10.0.0.26 THÀNH CÔNG! ===')
