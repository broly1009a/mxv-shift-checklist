import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

test_js = """
async function probeCreate() {
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('./dist/app.module');
  const { CoreCcpApiAdapter } = require('./dist/modules/ingress/adapters/coreccp-api.adapter');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const adapter = app.get(CoreCcpApiAdapter);
  const session = await adapter.getValidSession();
  const baseUrl = adapter.defaultBaseUrl || 'https://coreccp.vnclear.vn';

  const fekey = 'TEST_ORDERMATCH_' + Date.now();
  console.log('Testing createExportJob with fekey:', fekey);

  const res = await fetch(baseUrl + '/ccp/export/create', {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      Authorization: `Bearer ${session.accessToken}`,
      connectkey: 'fsscssiam2021',
      'Content-Type': 'application/json',
      Cookie: session.sessionCookie,
      Origin: baseUrl,
      Referer: baseUrl + '/ORDERS/ORDERMATCH_DETAIL',
    },
    body: JSON.stringify({
      searchcode: 'ORDERMATCH_DETAIL',
      search: {},
      filter: {},
      orderBy: {},
      page: { pageIndex: 1, pageSize: 20 },
      exptype: 'XLSX',
      fekey,
    }),
  });

  console.log('Response Status:', res.status);
  const data = await res.json();
  console.log('Response Body:', JSON.stringify(data, null, 2));

  await app.close();
}

probeCreate().catch(console.error);
"""

sftp = ssh.open_sftp()
with sftp.file('/opt/mxv-checklist/backend/probe_create.js', 'w') as f:
    f.write(test_js)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && node probe_create.js')
out = stdout.read().decode('utf-8', errors='ignore')
print(out)

ssh.close()
