import paramiko
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

files_to_sync = [
    # Frontend - Cấu hình & Giao diện đường dẫn
    'frontend/src/app/trading-manager/components/shared/TradingManagerConfigSection.tsx',
    'frontend/src/app/trading-manager/ms-cqg/page.tsx',
    'frontend/src/app/trading-manager/ccp-ce/page.tsx',
    'frontend/src/app/trading-manager/components/core-ccp/CcpCeBackupThongKeSection.tsx',
    'frontend/src/app/trading-manager/components/legacy-ms-cqg/LegacyBackupThongKeSection.tsx',
    'frontend/src/components/admin/SmartPathInput.tsx',
    
    # Backend - Helpers đường dẫn & Logic cấu hình
    'backend/src/modules/bot-engine/helpers/bot-path.helper.ts',
    'backend/src/shared/helpers/file-path.helper.ts',
    'backend/src/modules/trading-ops/services/qlgd-dashboard.service.ts',
    'backend/src/modules/trading-ops/services/ccp-accumulator.service.ts',
    'CHANGELOG_AI.md',
]

base_local = r'c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-modular-refactor'
base_remote = '/opt/mxv-checklist'

print('=== 1. KẾT NỐI SSH TỚI UBUNTU 10.0.0.26 ===')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

print('=== 2. TẢI FILE MỚI LÊN UBUNTU (/opt/mxv-checklist) ===')
sftp = ssh.open_sftp()
for rel in files_to_sync:
    local_path = os.path.join(base_local, rel)
    remote_path = os.path.join(base_remote, rel).replace('\\', '/')
    if not os.path.exists(local_path):
        print(f'[-] Local path not found: {local_path}')
        continue
    print(f'[+] Uploading {rel} -> {remote_path}...')
    sftp.put(local_path, remote_path)
sftp.close()
print('-> Hoàn tất tải toàn bộ files!')

print('\n=== 3. BUILD BACKEND TRÊN UBUNTU ===')
stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && npm run build')
out_be = stdout.read().decode('utf-8', errors='ignore')
err_be = stderr.read().decode('utf-8', errors='ignore')
print(out_be)
if err_be:
    print('BACKEND BUILD ERRORS:\n', err_be)

print('\n=== 4. RESTART PM2 MXV-BACKEND ===')
stdin, stdout, stderr = ssh.exec_command('pm2 restart mxv-backend')
print(stdout.read().decode('utf-8', errors='ignore'))

print('\n=== 5. BUILD FRONTEND TRÊN UBUNTU ===')
stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/frontend && npm run build')
out_fe = stdout.read().decode('utf-8', errors='ignore')
err_fe = stderr.read().decode('utf-8', errors='ignore')
print(out_fe)
if err_fe:
    print('FRONTEND BUILD ERRORS:\n', err_fe)

print('\n=== 6. RESTART PM2 MXV-FRONTEND ===')
stdin, stdout, stderr = ssh.exec_command('pm2 restart mxv-frontend')
print(stdout.read().decode('utf-8', errors='ignore'))

print('\n=== 7. KIỂM TRA TRẠNG THÁI PM2 ===')
stdin, stdout, stderr = ssh.exec_command('pm2 status')
print(stdout.read().decode('utf-8', errors='ignore'))

ssh.close()
print('=== HOÀN TẤT ĐỒNG BỘ VÀ TRIỂN KHAI LÊN UBUNTU! ===')
