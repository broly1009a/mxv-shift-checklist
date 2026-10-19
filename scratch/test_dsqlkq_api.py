import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = """cd /opt/mxv-checklist/backend && node -e '
(async () => {
  const fs = require("fs");
  const session = JSON.parse(fs.readFileSync("./temp/ms_session.json", "utf8"));
  const token = session.token;
  const res = await fetch("https://msadmin.mxv.com.vn/margin/admin/list/excel?limit=20&offset=0", {
    headers: { authorization: `Bearer ${token}` }
  });
  console.log("STATUS_WITH_LIMIT_20:", res.status);
  console.log("CONTENT_TYPE:", res.headers.get("content-type"));
  const buf = Buffer.from(await res.arrayBuffer());
  console.log("BYTE_LENGTH:", buf.length);
})();
'"""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('ascii', errors='ignore'))
print(stderr.read().decode('ascii', errors='ignore'))
client.close()
