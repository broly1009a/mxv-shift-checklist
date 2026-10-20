import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

js_code = r"""
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { CoreExApiAdapter } = require('./dist/modules/ingress/adapters/coreex-api.adapter');
const fs = require('fs');

(async () => {
  try {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
    const adapter = app.get(CoreExApiAdapter);

    console.log('Testing CoreExApiAdapter.getValidSession()...');
    const cachePath = '/opt/mxv-checklist/backend/temp/coreexchange_session.json';
    if (fs.existsSync(cachePath)) {
      console.log('Removing stale cache before test...');
      fs.unlinkSync(cachePath);
    }
    adapter['cachedSession'] = null;

    const session = await adapter.getValidSession();
    console.log('SUCCESS! Got session:');
    console.log('  BaseUrl:', session.baseUrl);
    console.log('  Username:', session.username);
    console.log('  SessionCookie:', session.sessionCookie);
    console.log('  AccessToken length:', session.accessToken ? session.accessToken.length : 0);

    console.log('Testing searchData on COMMODITY_ACM...');
    const res = await adapter.searchData(session, 'COMMODITY_ACM', { pageSize: 5 });
    console.log('SearchData SUCCESS! TotalCount:', res.totalCount, 'Rows:', res.rows.length);

    await app.close();
  } catch (err) {
    console.error('FAILED with error:', err);
    process.exit(1);
  }
})();
"""

sftp = ssh.open_sftp()
with sftp.file('/opt/mxv-checklist/backend/test_ce_login.js', 'w') as f:
    f.write(js_code)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && node test_ce_login.js && rm -f test_ce_login.js')
print('=== OUTPUT ===')
print(stdout.read().decode('utf-8'))
print('=== ERROR ===')
print(stderr.read().decode('utf-8'))

ssh.close()
