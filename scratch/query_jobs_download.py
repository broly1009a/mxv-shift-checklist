import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26')

cmd = """mongosh mxv_shift_checklist --quiet --eval "
  db.bot_jobs.find({
    jobType: 'DOWNLOAD_CCP_REPORT',
    createdAt: { \\$gte: new Date('2026-10-22T00:00:00Z') }
  }).sort({ createdAt: -1 }).limit(10).forEach(j => {
    print('--------------------------------------------------');
    print('ID: ' + j._id + ' | CreatedAt: ' + j.createdAt + ' | Status: ' + j.status);
    print('Payload: ' + JSON.stringify(j.payload));
  });
"
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
with open('scratch/ccp_download_jobs.txt', 'w', encoding='utf-8') as f:
    f.write(stdout.read().decode('utf-8'))
print('Written to scratch/ccp_download_jobs.txt')
ssh.close()
