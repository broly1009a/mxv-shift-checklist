import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

print('=== ALL USERS IN DATABASE ===')
cmd = """mongosh mxv_shift_checklist --quiet --eval "db.users.find({}).forEach(u => print(JSON.stringify({username: u.username, role: u.role, deptId: u.departmentId, fullName: u.fullName})))" """
stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='ignore'))

ssh.close()
