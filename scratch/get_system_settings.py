import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26')

cmd = """mongosh mxv_shift_checklist --quiet --eval "
  db.system_settings.find({
    key: { $in: ['bot_backup_time', 'bot_backup_time_enabled', 'bot_stat_time', 'bot_stat_time_enabled', 'bot_scheduler_config', 'session_start_time', 'ingress_mode_ccp', 'bot_auto_recon_enabled'] }
  }).forEach(s => print(s.key + ': ' + s.value));
"
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8'))
ssh.close()
