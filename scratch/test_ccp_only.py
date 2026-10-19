import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

test_script = """
require('/opt/mxv-checklist/backend/node_modules/dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { NestFactory } = require('/opt/mxv-checklist/backend/node_modules/@nestjs/core');
const { AppModule } = require('/opt/mxv-checklist/backend/dist/app.module');
const { CoreCcpApiAdapter } = require('/opt/mxv-checklist/backend/dist/modules/ingress/adapters/coreccp-api.adapter');

async function testCcpAdapter() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  
  console.log('--- TESTING CCP API ADAPTER (DSGD_CCP) ---');
  const ccpAdapter = app.get(CoreCcpApiAdapter);
  const ccpDir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/CCP/Futures/2026/T10.2026/16.10';
  const ccpRes = await ccpAdapter.download('CCP', {
    targetDate: '2026-10-16',
    outputDir: ccpDir,
    reportCodes: ['DSGD_CCP']
  });
  console.log('CCP Result:', {
    success: ccpRes.success,
    filesCount: (ccpRes.files || []).length,
    files: (ccpRes.files || []).map(f => ({ name: f.fileName, size: f.fileSize })),
    error: ccpRes.error
  });

  await app.close();
  process.exit(0);
}

testCcpAdapter().catch(e => { console.error('FATAL TEST ERROR:', e); process.exit(1); });
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/test_ccp_only.js', 'w') as f:
    f.write(test_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/test_ccp_only.js')
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print('STDOUT:\n', out.encode('ascii', errors='replace').decode('ascii'))
print('STDERR:\n', err.encode('ascii', errors='replace').decode('ascii'))
ssh.close()
