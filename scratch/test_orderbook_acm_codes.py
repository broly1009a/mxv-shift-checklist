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
  
  // Test searchCodes for Orderbook
  for (const code of ["ORDERBOOK_ACM", "ORDERBOOK_ALL_ACM", "ORDERBOOK"]) {
    try {
      const resToday = await adapter.searchData(session, code, { targetDate: "2026-10-19", pageSize: 5 });
      console.log(code, "targetDate 2026-10-19:", resToday.totalCount);
    } catch(e) {
      console.log(code, "targetDate 2026-10-19 error:", e.message);
    }

    try {
      const resNoDate = await adapter.searchData(session, code, { pageSize: 5 });
      console.log(code, "NO DATE:", resNoDate.totalCount);
    } catch(e) {
      console.log(code, "NO DATE error:", e.message);
    }
  }
})();
'"""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('ascii', errors='ignore'))
client.close()
