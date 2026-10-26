import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26')

cmd = """mongosh mxv_shift_checklist --quiet --eval "
  db.system_settings.find({ key: /backup|time|stat|schedule/i }).forEach(s => print(s.key + ': ' + s.value));
"
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
with open('scratch/settings_output.txt', 'w', encoding='utf-8') as f:
    f.write(stdout.read().decode('utf-8'))
print('Written to scratch/settings_output.txt')
ssh.close()
