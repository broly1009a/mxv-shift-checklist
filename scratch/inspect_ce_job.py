import paramiko
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

# Check job in mongo
cmd_job = """mongosh mxv_shift_checklist --eval 'JSON.stringify(db.bot_jobs.findOne({ _id: ObjectId("6ad6c2728f57489ea8539df9") }))' --quiet"""
_, out_j, _ = ssh.exec_command(cmd_job)
print('JOB DETAILS:')
print(out_j.read().decode('utf-8')[:1000])

# Check pm2 logs for CoreEX
cmd_log = 'grep -i "coreex" ~/.pm2/logs/mxv-backend-out.log | tail -n 40'
_, out_l, _ = ssh.exec_command(cmd_log)
print('\nPM2 OUT LOGS:')
print(out_l.read().decode('utf-8'))

cmd_err = 'grep -i "coreex" ~/.pm2/logs/mxv-backend-error.log | tail -n 40'
_, out_e, _ = ssh.exec_command(cmd_err)
print('\nPM2 ERR LOGS:')
print(out_e.read().decode('utf-8'))

# Check session cache
cmd_session = 'cat /opt/mxv-checklist/backend/temp/coreexchange_session.json'
_, out_s, _ = ssh.exec_command(cmd_session)
print('\nSESSION CACHE:')
print(out_s.read().decode('utf-8'))

ssh.close()
