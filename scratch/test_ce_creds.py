import paramiko
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = 'mongosh mxv_shift_checklist --eval \'JSON.stringify(db.system_settings.findOne({ key: "bot_credentials_ce" }))\' --quiet'
_, out, _ = ssh.exec_command(cmd)
res_ce = out.read().decode('utf-8')
print('bot_credentials_ce:', res_ce)

cmd_url = 'mongosh mxv_shift_checklist --eval \'JSON.stringify(db.system_settings.findOne({ key: "coreex_base_url" }))\' --quiet'
_, out_u, _ = ssh.exec_command(cmd_url)
print('coreex_base_url:', out_u.read().decode('utf-8'))

ssh.close()
