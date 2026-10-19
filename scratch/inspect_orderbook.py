import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = """cd /opt/mxv-checklist/backend && node -e '
(async () => {
  require("dotenv").config();
  const { CoreCcpApiAdapter } = require("./dist/modules/ingress/adapters/coreccp-api.adapter");
  const adapter = new CoreCcpApiAdapter();
  const session = await adapter.getValidSession();
  const baseUrl = "https://coreccp.vnclear.vn";

  const res = await adapter.searchFullJson(session, "ORDERBOOK", baseUrl, "/ORDERS/ORDERBOOK", {});
  console.log("ORDERBOOK_ROWS:", res.rows.length);
  if (res.rows.length > 0) {
    console.log("KEYS:", Object.keys(res.rows[0]));
    console.log("SAMPLE_ROW:", JSON.stringify(res.rows[0]));
  }
})();
'"""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('ascii', errors='ignore'))
print(stderr.read().decode('ascii', errors='ignore'))
client.close()
