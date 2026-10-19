import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

test_script = """
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('/opt/mxv-checklist/backend/dist/app.module');
const { CoreCcpApiAdapter } = require('/opt/mxv-checklist/backend/dist/modules/ingress/adapters/coreccp-api.adapter');

async function testExport() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log', 'debug'] });
  const adapter = app.get(CoreCcpApiAdapter);

  console.log('--- TEST DOWNLOAD DSGD_CCP ---');
  const session = await adapter.getValidSession();
  console.log('Session acquired: userId =', session.userId);

  const res = await adapter.download('2026-10-19', '/tmp/test_ccp', ['DSGD_CCP']);
  console.log('Result:', JSON.stringify(res, null, 2));

  await app.close();
}

testExport().catch(err => {
  console.error('Test Error:', err);
  process.exit(1);
});
"""

stdin, stdout, stderr = ssh.exec_command(f"node -e '{test_script}'")
print("=== TEST EXPORT OUTPUT ===")
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print("STDOUT:", out)
if err:
    print("STDERR:", err)

ssh.close()
