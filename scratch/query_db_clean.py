import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

print('=== 1. ROLES IN DATABASE ===')
cmd_roles = """mongosh mxv_shift_checklist --quiet --eval "db.roles.find({}).forEach(r => print(JSON.stringify({code: r.code, name: r.name, permissions: r.permissions})))" """
stdin, stdout, stderr = ssh.exec_command(cmd_roles)
print(stdout.read().decode('utf-8', errors='ignore'))

print('=== 2. DEPARTMENTS IN DATABASE ===')
cmd_depts = """mongosh mxv_shift_checklist --quiet --eval "db.departments.find({}).forEach(d => print(JSON.stringify({_id: d._id, code: d.code, name: d.name, parent: d.parentDepartmentId})))" """
stdin, stdout, stderr = ssh.exec_command(cmd_depts)
print(stdout.read().decode('utf-8', errors='ignore'))

print('=== 3. USERS (SAMPLE WITH DEPARTMENTS) ===')
cmd_users = """mongosh mxv_shift_checklist --quiet --eval "db.users.find({}).limit(15).forEach(u => print(JSON.stringify({username: u.username, role: u.role, deptId: u.departmentId})))" """
stdin, stdout, stderr = ssh.exec_command(cmd_users)
print(stdout.read().decode('utf-8', errors='ignore'))

ssh.close()
