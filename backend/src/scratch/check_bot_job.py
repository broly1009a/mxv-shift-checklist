import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26')

cmd = """
mongosh mxv_shift_checklist --eval '
  const job = db.bot_jobs.findOne({ _id: ObjectId("6ad89b0f070b464d4feacac9") });
  print(JSON.stringify(job, null, 2));
'
"""
stdin, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:\n", stdout.read().decode('utf-8', errors='ignore'))
print("STDERR:\n", stderr.read().decode('utf-8', errors='ignore'))
ssh.close()
