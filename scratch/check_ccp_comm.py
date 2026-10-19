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
  const res = await adapter.searchFullJson(session, "COMMODITY", "https://coreccp.vnclear.vn", "/PRODUCT/COMMODITY");
  console.log("COMMODITY totalCount:", res.totalCount, "rows length:", res.rows.length);
  if (res.rows.length > 0) {
    console.log("First row keys:", Object.keys(res.rows[0]));
    console.log("First 5 rows:", res.rows.slice(0, 5).map(r => ({ UACODE: r.UACODE, uacode: r.uacode, COMMODITY_CODE: r.COMMODITY_CODE, SYMBOL: r.SYMBOL, name: r.VN_FULLNAME || r.COMMODITY_NAME })));
  }
})();
'"""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('ascii', errors='ignore'))
print(stderr.read().decode('ascii', errors='ignore'))
client.close()
