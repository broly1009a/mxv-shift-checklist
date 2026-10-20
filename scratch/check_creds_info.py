import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

cmd = """node -e '
const mongoose = require("/opt/mxv-checklist/backend/node_modules/mongoose");
const fs = require("fs");
const dotenv = require("/opt/mxv-checklist/backend/node_modules/dotenv");
const env = dotenv.parse(fs.readFileSync("/opt/mxv-checklist/backend/.env"));
const crypto = require("crypto");

function decrypt(text) {
  if (!text) return "";
  try {
    const key = crypto.createHash("sha256").update("trading_mxv_secret_key_2026").digest();
    const parts = text.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(parts[1], "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch { return ""; }
}

(async () => {
  await mongoose.connect(env.MONGODB_URI);
  const db = mongoose.connection.db;
  const ccpCred = await db.collection("system_configs").findOne({ key: "bot_credentials_ccp" });
  const ceCred = await db.collection("system_configs").findOne({ key: "bot_credentials_ce" });

  console.log("CCP Credential URL/User:", ccpCred ? JSON.parse(decrypt(ccpCred.value)).url + " / " + JSON.parse(decrypt(ccpCred.value)).username : "none");
  console.log("CE Credential URL/User:", ceCred ? JSON.parse(decrypt(ceCred.value)).url + " / " + JSON.parse(decrypt(ceCred.value)).username : "none");

  await mongoose.disconnect();
})();
'"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='ignore'))
ssh.close()
