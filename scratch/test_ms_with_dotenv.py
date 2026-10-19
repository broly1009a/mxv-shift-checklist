import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

test_script = """
require('/opt/mxv-checklist/backend/node_modules/dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { NestFactory } = require('/opt/mxv-checklist/backend/node_modules/@nestjs/core');
const { AppModule } = require('/opt/mxv-checklist/backend/dist/app.module');
const { MsApiAdapter } = require('/opt/mxv-checklist/backend/dist/modules/ingress/adapters/ms-api.adapter');

async function testMs() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const msAdapter = app.get(MsApiAdapter);
  console.log('Testing msAdapter.download for TTTT...');
  try {
    const res = await msAdapter.download('MS', {
      reportType: 'TTTT',
      outputDir: '/tmp/test_ms_download',
      targetDate: '2026-10-16'
    });
    console.log('Result TTTT:', JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('Error downloading TTTT:', e);
  }

  await app.close();
  process.exit(0);
}

testMs().catch(e => { console.error(e); process.exit(1); });
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/test_ms_with_dotenv.js', 'w') as f:
    f.write(test_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/test_ms_with_dotenv.js')
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print('STDOUT:\n', out.encode('ascii', errors='replace').decode('ascii'))
print('STDERR:\n', err.encode('ascii', errors='replace').decode('ascii'))
ssh.close()
