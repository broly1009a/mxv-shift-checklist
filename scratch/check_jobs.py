import paramiko
import json

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = '''cd /opt/mxv-checklist/backend && node -e '
const mongoose = require("mongoose");
async function run() {
  await mongoose.connect("mongodb://127.0.0.1:27017/mxv_shift_checklist");
  const jobs = await mongoose.connection.collection("bot_jobs").find({
    createdAt: { $gte: new Date("2026-10-18T17:00:00Z") }
  }).sort({ createdAt: -1 }).limit(20).toArray();
  
  console.log("Total jobs found:", jobs.length);
  for (const j of jobs) {
    console.log(j._id, j.jobType, j.status, j.triggerType || j.triggeredBy, j.createdAt, j.payload?.result ? "hasResult" : "noResult");
  }
  await mongoose.disconnect();
}
run();
'
'''


stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8'))
print(stderr.read().decode('utf-8'))
ssh.close()
