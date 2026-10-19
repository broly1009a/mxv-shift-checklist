import paramiko
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = '''cd /opt/mxv-checklist/backend && node -e '
const mongoose = require("mongoose");
async function run() {
  await mongoose.connect("mongodb://127.0.0.1:27017/mxv_shift_checklist");
  const job = await mongoose.connection.collection("bot_jobs").findOne({
    _id: new mongoose.Types.ObjectId("6ad579d87940c0e955b5ce7c")
  });
  console.log("Full payload keys:", Object.keys(job.payload || {}));
  console.log("Result summary:", job.payload?.result?.summary);
  console.log("Result totals:", job.payload?.result?.totals);
  console.log("Has mismatchedTrades:", Boolean(job.payload?.result?.mismatchedTrades));
  console.log("Has pendingSyncTrades:", Boolean(job.payload?.result?.pendingSyncTrades));
  await mongoose.disconnect();
}
run();
'
'''

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8'))
ssh.close()
