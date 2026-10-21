import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26')

cmd = """
node -e '
const fs = require("fs");
const XLSX = require("/opt/mxv-checklist/backend/node_modules/xlsx");

async function run() {
  const s = JSON.parse(fs.readFileSync("/opt/mxv-checklist/backend/temp/ms_session.json", "utf8"));
  const token = s.token;
  const baseUrl = "https://msapi.mxv.com.vn";
  const adminUrl = "https://msadmin.mxv.com.vn";

  const headers = {
    accept: "application/json, text/plain, */*",
    authorization: `Bearer ${token}`,
    origin: adminUrl,
    referer: `${adminUrl}/`,
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  };

  // Call without params
  const res1 = await fetch(`${baseUrl}/transaction/admin/list/excel`, { headers });
  const buf1 = Buffer.from(await res1.arrayBuffer());
  console.log("No params: status=", res1.status, "bytes=", buf1.length);
  if (res1.status === 200) {
    const wb1 = XLSX.read(buf1);
    const rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1 });
    console.log("No params rows:", rows1.length);
  } else {
    console.log("Response text:", buf1.toString().slice(0, 200));
  }

  // Call with sessionDate params
  const startMs = Date.UTC(2026, 9, 21, 0, 0, 0, 0) - 7 * 3600 * 1000;
  const endMs = startMs + 24 * 3600 * 1000 - 1;
  const url2 = `${baseUrl}/transaction/admin/list/excel?transactions.sessionDate[gte]=${startMs}&transactions.sessionDate[lte]=${endMs}`;
  const res2 = await fetch(url2, { headers });
  const buf2 = Buffer.from(await res2.arrayBuffer());
  console.log("With sessionDate: status=", res2.status, "bytes=", buf2.length);
  if (res2.status === 200) {
    const wb2 = XLSX.read(buf2);
    const rows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1 });
    console.log("With sessionDate rows:", rows2.length);
  }
}
run().catch(console.error);
'
"""
stdin, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:\n", stdout.read().decode('utf-8', errors='ignore'))
print("STDERR:\n", stderr.read().decode('utf-8', errors='ignore'))
ssh.close()
