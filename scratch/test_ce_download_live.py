import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

# Delete stale cache on Ubuntu
ssh.exec_command('rm -f /opt/mxv-checklist/backend/temp/coreexchange_session.json')

# Test download via IngressService
js_code = r"""
require('dotenv').config();
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { IngressService } = require('./dist/modules/ingress/ingress.service');

(async () => {
  try {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
    const ingress = app.get(IngressService);

    console.log('Testing ingress.download(CORE_EX)...');
    const today = new Date().toISOString().split('T')[0];
    const res = await ingress.download('CORE_EX', {
      targetDirectory: '/opt/mxv-checklist/backend/data/test_ce_download',
      reportCodes: ['FULL'],
      targetDate: today,
      isFullBackup: true
    });

    console.log('\n=== INGRESS RESULT ===');
    console.log('  Success:', res.success);
    console.log('  Files count:', res.files.length);
    console.log('  Duration:', res.durationMs, 'ms');
    for (const f of res.files) {
      console.log(`    - ${f.fileName} (${f.fileSize} bytes)`);
    }

    await app.close();
    process.exit(0);
  } catch (err) {
    console.error('Download FAILED:', err);
    process.exit(1);
  }
})();
"""

sftp = ssh.open_sftp()
with sftp.file('/opt/mxv-checklist/backend/test_ce_download_real.js', 'w') as f:
    f.write(js_code)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && node test_ce_download_real.js && rm -f test_ce_download_real.js')
print(stdout.read().decode('utf-8'))
print(stderr.read().decode('utf-8'))

ssh.close()
