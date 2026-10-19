import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = """cd /opt/mxv-checklist/backend && node -e '
(async () => {
  const mongoose = require("mongoose");
  require("dotenv").config();
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const job = await db.collection("bot_jobs").findOne({ _id: new mongoose.Types.ObjectId("6ad5d1b177c8e3ac52be8f05") });
  if (job) {
    console.log("JOB_TYPE:", job.jobType);
    console.log("STATUS:", job.status);
    console.log("PAYLOAD:", JSON.stringify(job.payload));
    console.log("LOGS:");
    job.logs.forEach(l => console.log(" ", l));
  } else {
    console.log("JOB_NOT_FOUND");
  }
  await mongoose.disconnect();
})();
'"""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('ascii', errors='ignore'))
print(stderr.read().decode('ascii', errors='ignore'))
client.close()
