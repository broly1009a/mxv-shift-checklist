import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

cmd = """node -e '
const mongoose = require("/opt/mxv-checklist/backend/node_modules/mongoose");
const fs = require("fs");
const dotenv = require("/opt/mxv-checklist/backend/node_modules/dotenv");
const env = dotenv.parse(fs.readFileSync("/opt/mxv-checklist/backend/.env"));
const uri = env.MONGODB_URI;

(async () => {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const job = await db.collection("bot_jobs").findOne({ _id: new mongoose.Types.ObjectId("6ad5f61e67544cdff20cac11") });
  if (job) {
    console.log("=== FOUND JOB ===");
    console.log("JobType:", job.jobType);
    console.log("Status:", job.status);
    console.log("Payload:", JSON.stringify(job.payload, null, 2));
    console.log("Logs count:", (job.logs || []).length);
    (job.logs || []).forEach(l => console.log(" ", l));
  } else {
    console.log("Job 6ad5f61e67544cdff20cac11 not found!");
  }
  await mongoose.disconnect();
})();
'"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='ignore'))
err = stderr.read().decode('utf-8', errors='ignore')
if err:
    print('STDERR:', err)

ssh.close()
