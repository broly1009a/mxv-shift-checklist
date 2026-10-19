import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

test_js = """
const path = require('path');
const fs = require('fs');

async function main() {
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('./dist/app.module');
  const { CoreCcpApiAdapter } = require('./dist/modules/ingress/adapters/coreccp-api.adapter');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const adapter = app.get(CoreCcpApiAdapter);

  console.log('--- TEST DOWNLOAD DSGD_CCP ---');
  const session = await adapter.getValidSession();
  console.log('Session acquired: userId =', session.userId);

  const res = await adapter.download('2026-10-19', '/tmp/test_ccp', ['DSGD_CCP']);
  console.log('Result:', JSON.stringify(res, null, 2));

  await app.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
"""

sftp = ssh.open_sftp()
with sftp.file('/opt/mxv-checklist/backend/test_ccp_runner.js', 'w') as f:
    f.write(test_js)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && node test_ccp_runner.js')
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print("STDOUT:", out)
if err:
    print("STDERR:", err)

ssh.close()
