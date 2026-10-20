import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

cmd = """node -e '
const mongoose = require("/opt/mxv-checklist/backend/node_modules/mongoose");
const fs = require("fs");
const dotenv = require("/opt/mxv-checklist/backend/node_modules/dotenv");
const env = dotenv.parse(fs.readFileSync("/opt/mxv-checklist/backend/.env"));

(async () => {
  await mongoose.connect(env.MONGODB_URI);
  const db = mongoose.connection.db;
  const configs = await db.collection("system_configs").find({
    key: { $in: ["ingress_mode", "ingress_mode_ccp", "ingress_mode_ce", "ingress_mode_ms"] }
  }).toArray();
  console.log("=== INGRESS MODES IN DB ===");
  console.log(JSON.stringify(configs, null, 2));
  await mongoose.disconnect();
})();
'"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='ignore'))
ssh.close()
