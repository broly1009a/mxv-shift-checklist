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
  
  // Test smart query for DSL
  let res = await adapter.searchData(session, "ORDERBOOK_ALL_ACM", { targetDate: "2026-10-19", pageSize: 200000 });
  console.log("ORDERBOOK_ALL_ACM 2026-10-19 rows:", res.rows.length);
  if (res.rows.length === 0) {
    console.log("-> Fallback to ORDERBOOK_ACM (In-Session)...");
    res = await adapter.searchData(session, "ORDERBOOK_ACM", { targetDate: "2026-10-19", pageSize: 200000 });
    console.log("ORDERBOOK_ACM 2026-10-19 rows:", res.rows.length);
  }

  // Check filtering
  const dslH = res.rows.filter(r => r.STATUS === "DD" || r.EN_STATUS === "Cancelled");
  const dslCk = res.rows.filter(r => ["SS", "BB"].includes(r.STATUS) || ["New", "PendingNew"].includes(r.EN_STATUS));
  const dslDk = res.rows.filter(r => r.STATUS === "TS" || r.EN_STATUS === "Filled");

  console.log("Filtered DSLH (Lệnh hủy):", dslH.length);
  console.log("Filtered DSLCK (Lệnh chờ khớp):", dslCk.length);
  console.log("Filtered DSLDK (Lệnh đã khớp):", dslDk.length);
})();
'"""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('ascii', errors='ignore'))
client.close()
