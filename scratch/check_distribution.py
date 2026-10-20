import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = """cd /opt/mxv-checklist/backend && node -e '
(async () => {
  require("dotenv").config();
  const { CoreExApiAdapter } = require("./dist/modules/ingress/adapters/coreex-api.adapter");
  const adapter = new CoreExApiAdapter();
  const session = await adapter.getValidSession();
  
  // Test ORDERBOOK_ALL_ACM with T-1 (2026-10-16)
  const resT1 = await adapter.searchData(session, "ORDERBOOK_ALL_ACM", { targetDate: "2026-10-16", pageSize: 200000 });
  console.log("ORDERBOOK_ALL_ACM with T-1 (2026-10-16) total rows:", resT1.rows.length);

  // Test ORDERMATCH_ALL_ACM with T-1 (2026-10-16)
  try {
    const resMatchAll = await adapter.searchData(session, "ORDERMATCH_ALL_ACM", { targetDate: "2026-10-16", pageSize: 200000 });
    console.log("ORDERMATCH_ALL_ACM with T-1 (2026-10-16) total rows:", resMatchAll.rows.length);
  } catch(e) {
    console.log("ORDERMATCH_ALL_ACM error:", e.message);
  }
})();
'"""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('ascii', errors='ignore'))
client.close()
