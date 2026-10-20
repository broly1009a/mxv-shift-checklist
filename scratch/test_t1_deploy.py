import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = """cd /opt/mxv-checklist/backend && node -e '
(async () => {
  require("dotenv").config();
  const { CoreExApiAdapter } = require("./dist/modules/ingress/adapters/coreex-api.adapter");
  const adapter = new CoreExApiAdapter();
  
  // Test downloadReports for DSL with targetDate = 2026-10-19
  console.log("Testing downloadReports for DSL with targetDate 2026-10-19...");
  const res = await adapter.downloadReports({
    targetDate: "2026-10-19",
    outputDirectory: "/tmp/test_ce_t1_download",
    reports: ["DSL"]
  });

  console.log("Success:", res.success);
  console.log("Files produced:");
  for (const f of res.files) {
    console.log(`  - ${f.fileName} (${f.fileSize} bytes) | RowCount: ${f.metadata?.rowCount}`);
  }
})();
'"""

stdin, stdout, stderr = client.exec_command(cmd)
print("STDOUT:\n", stdout.read().decode('ascii', errors='ignore'))
err = stderr.read().decode('ascii', errors='ignore')
if err:
    print("STDERR:\n", err)
client.close()
