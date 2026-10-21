import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26')

cmd = """
node -e '
const { NestFactory } = require("/opt/mxv-checklist/backend/node_modules/@nestjs/core");
const { AppModule } = require("/opt/mxv-checklist/backend/dist/app.module");
const { MsApiAdapter } = require("/opt/mxv-checklist/backend/dist/modules/ingress/adapters/ms-api.adapter");
const XLSX = require("/opt/mxv-checklist/backend/node_modules/xlsx");

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const msAdapter = app.get(MsApiAdapter);
  const session = await msAdapter.getValidToken(true);
  const token = session.token;
  const baseUrl = session.baseUrl;
  const adminUrl = session.adminUrl;

  console.log("Got valid token. Testing with and without sessionDate params...");

  // 1. Without params
  const res1 = await fetch(`${baseUrl}/transaction/admin/list/excel`, {
    headers: {
      authorization: `Bearer ${token}`,
      origin: adminUrl,
      referer: `${adminUrl}/`,
      "user-agent": "Mozilla/5.0"
    }
  });
  const buf1 = Buffer.from(await res1.arrayBuffer());
  const wb1 = XLSX.read(buf1);
  const rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1 });
  console.log("1. No params: HTTP", res1.status, "bytes:", buf1.length, "rows:", rows1.length);

  // 2. With sessionDate params for 2026-10-21
  const startMs = Date.UTC(2026, 9, 21, 0, 0, 0, 0) - 7 * 3600 * 1000;
  const endMs = startMs + 24 * 3600 * 1000 - 1;
  const url2 = `${baseUrl}/transaction/admin/list/excel?transactions.sessionDate[gte]=${startMs}&transactions.sessionDate[lte]=${endMs}`;
  const res2 = await fetch(url2, {
    headers: {
      authorization: `Bearer ${token}`,
      origin: adminUrl,
      referer: `${adminUrl}/`,
      "user-agent": "Mozilla/5.0"
    }
  });
  const buf2 = Buffer.from(await res2.arrayBuffer());
  const wb2 = XLSX.read(buf2);
  const rows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1 });
  console.log("2. With sessionDate params: HTTP", res2.status, "bytes:", buf2.length, "rows:", rows2.length);

  // 3. For a PAST DATE (e.g. 2026-10-20)
  const startMsPast = Date.UTC(2026, 9, 20, 0, 0, 0, 0) - 7 * 3600 * 1000;
  const endMsPast = startMsPast + 24 * 3600 * 1000 - 1;
  const url3 = `${baseUrl}/transaction/admin/list/excel?transactions.sessionDate[gte]=${startMsPast}&transactions.sessionDate[lte]=${endMsPast}`;
  const res3 = await fetch(url3, {
    headers: {
      authorization: `Bearer ${token}`,
      origin: adminUrl,
      referer: `${adminUrl}/`,
      "user-agent": "Mozilla/5.0"
    }
  });
  const buf3 = Buffer.from(await res3.arrayBuffer());
  const wb3 = XLSX.read(buf3);
  const rows3 = XLSX.utils.sheet_to_json(wb3.Sheets[wb3.SheetNames[0]], { header: 1 });
  console.log("3. Past date (2026-10-20): HTTP", res3.status, "bytes:", buf3.length, "rows:", rows3.length);

  await app.close();
}
run().catch(console.error);
'
"""
stdin, stdout, stderr = ssh.exec_command(cmd)
print("STDOUT:\n", stdout.read().decode('utf-8', errors='ignore'))
print("STDERR:\n", stderr.read().decode('utf-8', errors='ignore'))
ssh.close()
