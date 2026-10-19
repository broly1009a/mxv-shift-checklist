import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = """cd /opt/mxv-checklist/backend && node -e '
(async () => {
  require("dotenv").config();
  const { CoreCcpApiAdapter } = require("./dist/modules/ingress/adapters/coreccp-api.adapter");
  const adapter = new CoreCcpApiAdapter();
  console.log("Bat dau goi download CoreCCP FULL...");
  const t0 = Date.now();
  try {
    const res = await adapter.download("CCP", {
      isFullBackup: true,
      targetDate: "2026-10-19",
      targetDirectory: "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/19.10"
    });
    console.log(`HOAN_TAT: ${res.files.length} files trong ${Date.now() - t0}ms, success: ${res.success}`);
    res.files.forEach(f => console.log(`  + ${f.fileName}: ${f.fileSize} bytes`));
    if (res.error) console.log("ERROR:", res.error);
  } catch (err) {
    console.log("CATCH_ERR:", err.message, "sau", Date.now() - t0, "ms");
  }
})();
'"""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('ascii', errors='ignore'))
print(stderr.read().decode('ascii', errors='ignore'))
client.close()
