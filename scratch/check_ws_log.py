import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

cmd1 = """
grep -n -C 15 "ORDERMATCH_DETAIL_1792381162436" ~/.pm2/logs/* 2>/dev/null
"""
stdin, stdout, stderr = ssh.exec_command(cmd1)
out1 = stdout.read().decode('utf-8', errors='ignore')
print("=== PM2 LOGS FOR FEKEY ===")
print(out1 if out1.strip() else "(No direct grep match in ~/.pm2/logs/*)")

# Query mongodb bot_jobs
cmd2 = """
node -e '
const mongoose = require("/opt/mxv-checklist/backend/node_modules/mongoose");
async function run() {
  await mongoose.connect("mongodb://127.0.0.1:27017/mxv-shift-checklist");
  const job = await mongoose.connection.collection("bot_jobs").findOne({
    logs: { $regex: "ORDERMATCH_DETAIL_1792381162436" }
  });
  if (!job) {
    console.log("No job found in bot_jobs matching fekey");
    // Find latest CHECK_KLGD jobs
    const jobs = await mongoose.connection.collection("bot_jobs")
      .find({ jobType: "CHECK_KLGD" })
      .sort({ createdAt: -1 })
      .limit(3)
      .toArray();
    for (const j of jobs) {
      console.log("Job:", j._id, "status:", j.status, "createdAt:", j.createdAt);
      console.log("Logs sample:", (j.logs || []).slice(-10).join("\\n"));
    }
    return;
  }
  console.log("Job ID:", job._id, "status:", job.status, "attempts:", job.attempts);
  console.log("FULL LOGS:");
  job.logs.forEach(l => console.log(l));
  console.log("ERROR:", job.error);
}
run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
'
"""
stdin, stdout, stderr = ssh.exec_command(cmd2)
out2 = stdout.read().decode('utf-8', errors='ignore')
print("=== MONGODB JOB DETAILS ===")
print(out2)

ssh.close()
