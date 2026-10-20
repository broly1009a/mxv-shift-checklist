import paramiko
import json

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = """cd /opt/mxv-checklist/backend && node -e '
(async () => {
  require("dotenv").config();
  const { CoreExApiAdapter } = require("./dist/modules/ingress/adapters/coreex-api.adapter");
  const adapter = new CoreExApiAdapter();
  const session = await adapter.getValidSession();
  
  const res = await adapter.searchData(session, "ORDERBOOK_ACM", { targetDate: "2026-10-19", pageSize: 2000 });
  console.log("Total rows in ORDERBOOK_ACM:", res.rows.length);
  
  const statusCounts = {};
  for (const r of res.rows) {
    const key = `${r.STATUS} - ${r.STATUS_DESC} (${r.EN_STATUS})`;
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  }
  console.log("STATUS BREAKDOWN IN ORDERBOOK_ACM (targetDate 2026-10-19):");
  console.log(JSON.stringify(statusCounts, null, 2));
})();
'"""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('ascii', errors='ignore'))
client.close()
