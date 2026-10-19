import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = """cd /opt/mxv-checklist/backend && node -e '
(async () => {
  require("dotenv").config();
  const { CoreCcpApiAdapter, CORECCP_API_REPORTS } = require("./dist/modules/ingress/adapters/coreccp-api.adapter");
  const adapter = new CoreCcpApiAdapter();
  const session = await adapter.getValidSession();
  const baseUrl = "https://coreccp.vnclear.vn";

  console.log("TESTING ALL CORECCP SEARCH CODES:");
  const tested = new Set();
  for (const [key, def] of Object.entries(CORECCP_API_REPORTS)) {
    if (tested.has(def.searchCode)) continue;
    tested.add(def.searchCode);

    try {
      const res = await adapter.searchFullJson(session, def.searchCode, baseUrl, def.route, def.filterPayload || {});
      console.log(`[PASS 200] ${def.searchCode.padEnd(25)} -> ${res.rows.length} rows (Key: ${key})`);
    } catch (err) {
      const is404 = err.message.includes("404");
      const is403 = err.message.includes("403");
      const status = is404 ? "404 Not Found" : (is403 ? "403 Forbidden" : err.message.slice(0, 40));
      console.log(`[FAIL ${status.padEnd(13)}] ${def.searchCode.padEnd(25)} (Key: ${key})`);
    }
  }
})();
'"""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('ascii', errors='ignore'))
print(stderr.read().decode('ascii', errors='ignore'))
client.close()
