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
    jobType: "CHECK_KLGD",
    status: "COMPLETED"
  }).sort({ createdAt: -1 }).limit(3).toArray();
  for (const j of jobs) {
    console.log("=== JOB", j._id, j.createdAt, "===");
    console.log("payload keys:", Object.keys(j.payload || {}));
    if (j.payload?.files) console.log("files:", j.payload.files);
    if (j.payload?.result?.checkTime) console.log("checkTime:", j.payload.result.checkTime);
    if (j.payload?.result?.cutoffTime) console.log("cutoffTime:", j.payload.result.cutoffTime);
    if (j.payload?.result?.mismatchedTradesCount !== undefined) {
      console.log("totals:", j.payload.result.totals);
    }
  }
  await mongoose.disconnect();
}
run();
'
'''

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8'))
ssh.close()
