import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

test_js = """
async function probeReports() {
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('./dist/app.module');
  const { CoreCcpApiAdapter } = require('./dist/modules/ingress/adapters/coreccp-api.adapter');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const adapter = app.get(CoreCcpApiAdapter);
  const session = await adapter.getValidSession();
  const baseUrl = adapter.defaultBaseUrl || 'https://coreccp.vnclear.vn';

  // Probe reports around 42955 - 42965
  for (let id = 42955; id <= 42965; id++) {
    try {
      const buf = await adapter.downloadReportBinary(session, id, baseUrl);
      console.log(`Report ID ${id}: SUCCESS (${buf.length} bytes)`);
    } catch (err) {
      console.log(`Report ID ${id}: Failed (${err.message})`);
    }
  }

  await app.close();
}

probeReports().catch(console.error);
"""

sftp = ssh.open_sftp()
with sftp.file('/opt/mxv-checklist/backend/probe_reports.js', 'w') as f:
    f.write(test_js)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && node probe_reports.js')
out = stdout.read().decode('utf-8', errors='ignore')
print(out)

ssh.close()
