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
  
  // 1. ORDERBOOK on CoreCCP
  const resBookToday = await adapter.searchFullJson(session, "ORDERBOOK", baseUrl, "/ORDERS/ORDERBOOK");
  console.log("CoreCCP ORDERBOOK total rows:", resBookToday.rows.length);

  // 2. ORDERBOOK_MM on CoreCCP today
  const resMmToday = await adapter.searchFullJson(session, "ORDERBOOK_MM", baseUrl, "/ORDERS/ORDERBOOK_MM");
  console.log("CoreCCP ORDERBOOK_MM (Today):", resMmToday.rows.length);

  // Check if ORDERBOOK_MM supports search with SESSION_DATE
  try {
    const resMm16 = await adapter.searchFullJson(session, "ORDERBOOK_MM", baseUrl, "/ORDERS/ORDERBOOK_MM", {
      search: { SESSION_DATE: { from: "16/10/2026", to: "16/10/2026" } }
    });
    console.log("CoreCCP ORDERBOOK_MM (16/10/2026):", resMm16.rows.length);
  } catch(e) {
    console.log("CoreCCP ORDERBOOK_MM 16/10 error:", e.message);
  }

  // 3. ORDERMATCH_DETAIL on CoreCCP
  const resMatch = await adapter.searchFullJson(session, "ORDERMATCH_DETAIL", baseUrl, "/ORDERS/ORDERMATCH_DETAIL");
  console.log("CoreCCP ORDERMATCH_DETAIL (Today):", resMatch.rows.length);

  // 4. Check if there are historical codes on CoreCCP
  for (const c of ["ORDERBOOK_ALL", "ORDERBOOK_ALL_MM", "ORDERMATCH_ALL", "CASHTRANFER_HIST"]) {
    try {
      const r = await adapter.searchFullJson(session, c, baseUrl, "/");
      console.log(`CoreCCP ${c} supported! Rows:`, r.rows.length);
    } catch(e) {
      console.log(`CoreCCP ${c} error:`, e.message);
    }
  }
})();
'"""

stdin, stdout, stderr = client.exec_command(cmd)
print("STDOUT:\n", stdout.read().decode('ascii', errors='ignore'))
err = stderr.read().decode('ascii', errors='ignore')
if err:
    print("STDERR:\n", err)
client.close()
