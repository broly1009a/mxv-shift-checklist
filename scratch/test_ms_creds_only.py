import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

test_script = """
const { NestFactory } = require('/opt/mxv-checklist/backend/node_modules/@nestjs/core');
const { AppModule } = require('/opt/mxv-checklist/backend/dist/app.module');
const { MsApiAdapter } = require('/opt/mxv-checklist/backend/dist/modules/ingress/adapters/ms-api.adapter');

async function testCreds() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const msAdapter = app.get(MsApiAdapter);
  const creds = await msAdapter.getCredentials();
  console.log('Creds from msAdapter:', {
    adminUrl: creds.adminUrl,
    baseUrl: creds.baseUrl,
    username: creds.username,
    hasPassword: !!creds.password,
    pin: creds.pin
  });
  await app.close();
  process.exit(0);
}

testCreds().catch(e => { console.error(e); process.exit(1); });
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/test_ms_creds_only.js', 'w') as f:
    f.write(test_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/test_ms_creds_only.js')
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print('STDOUT:\n', out.encode('ascii', errors='replace').decode('ascii'))
print('STDERR:\n', err.encode('ascii', errors='replace').decode('ascii'))
ssh.close()
