import paramiko
import json

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = '''cd /opt/mxv-checklist/backend && node -e '
const mongoose = require("mongoose");
async function run() {
  await mongoose.connect("mongodb://127.0.0.1:27017/mxv_shift_checklist");
  const job = await mongoose.connection.collection("bot_jobs").findOne({
    _id: new mongoose.Types.ObjectId("6ad58a6906b3c6b7bf78d318")
  });
  console.log("Job status:", job.status);
  console.log("Job triggerType:", job.triggerType);
  console.log("Job payload keys:", Object.keys(job.payload || {}));
  console.log("Job result keys:", Object.keys(job.payload?.result || {}));
  console.log("Totals:", job.payload?.result?.totals);
  await mongoose.disconnect();
}
run();
'
'''

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8'))
print(stderr.read().decode('utf-8'))
ssh.close()
