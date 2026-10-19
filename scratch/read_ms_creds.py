import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = """cd /opt/mxv-checklist/backend && node -e '
(async () => {
  const mongoose = require("mongoose");
  require("dotenv").config();
  const { decrypt } = require("./dist/shared/helpers/crypto");

  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  const setting = await mongoose.connection.db.collection("system_settings").findOne({ key: "bot_credentials_msystem" });
  if (setting) {
    const raw = decrypt(setting.value);
    const parsed = JSON.parse(raw);
    console.log("URL:", parsed.url);
    console.log("API_URL:", parsed.apiUrl);
    console.log("BASE_URL:", parsed.baseUrl);
    console.log("USERNAME:", parsed.username);
  } else {
    console.log("NOT_FOUND");
  }
  await mongoose.disconnect();
})();
'"""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('ascii', errors='ignore'))
print(stderr.read().decode('ascii', errors='ignore'))
client.close()
