import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=15)

# Xóa file rác HĐ ACM.xlsx cũ nếu còn sót lại
client.exec_command('rm -f "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CE/Futures/2026/T10.2026/19.10/HĐ ACM.xlsx"')

stdin, stdout, stderr = client.exec_command('cd /opt/mxv-checklist/backend && node /tmp/audit_backup_files.js')
print(stdout.read().decode('utf-8', errors='ignore'))
err = stderr.read().decode('utf-8', errors='ignore')
if err:
    print('STDERR:', err)
client.close()
