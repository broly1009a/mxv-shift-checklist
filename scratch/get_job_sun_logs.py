import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26')

cmd = """mongosh mxv_shift_checklist --quiet --eval "
  const j = db.bot_jobs.findOne({ _id: ObjectId('6add29343c0f60968b48451b') });
  print('Job Sun Oct 25 04:55:00:');
  print((j.logs || []).join('\\n'));
"
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
with open('scratch/job_sun_logs.txt', 'w', encoding='utf-8') as f:
    f.write(stdout.read().decode('utf-8'))
print('Written to scratch/job_sun_logs.txt')
ssh.close()
