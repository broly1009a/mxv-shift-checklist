import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

# DO NOT delete cache -> Test cache reuse & verification!
js_code = r"""
require('dotenv').config();
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { IngressService } = require('./dist/modules/ingress/ingress.service');

(async () => {
  try {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
    const ingress = app.get(IngressService);

    console.log('Testing ingress.download(CORE_EX) WITH REUSED CACHED SESSION...');
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

    await app.close();
    process.exit(0);
  } catch (err) {
    console.error('Download FAILED:', err);
    process.exit(1);
  }
})();
"""

sftp = ssh.open_sftp()
with sftp.file('/opt/mxv-checklist/backend/test_ce_download_cached.js', 'w') as f:
    f.write(js_code)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && node test_ce_download_cached.js && rm -f test_ce_download_cached.js')
print(stdout.read().decode('utf-8'))
print(stderr.read().decode('utf-8'))

ssh.close()
