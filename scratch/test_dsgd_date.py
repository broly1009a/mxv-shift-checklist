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
  
  const dsgd19 = await adapter.searchData(session, "ORDERMATCH_DETAIL_ACM", { targetDate: "2026-10-19", pageSize: 5 });
  console.log("DSGD targetDate 2026-10-19 totalCount:", dsgd19.totalCount);

  const dsgd16 = await adapter.searchData(session, "ORDERMATCH_DETAIL_ACM", { targetDate: "2026-10-16", pageSize: 5 });
  console.log("DSGD targetDate 2026-10-16 totalCount:", dsgd16.totalCount);
})();
'"""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('ascii', errors='ignore'))
client.close()
