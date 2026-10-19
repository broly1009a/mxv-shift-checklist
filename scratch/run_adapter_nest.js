const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));

const scriptContent = `
require('/opt/mxv-checklist/backend/node_modules/dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { NestFactory } = require('/opt/mxv-checklist/backend/node_modules/@nestjs/core');
const { AppModule } = require('/opt/mxv-checklist/backend/dist/app.module');
const { CoreCcpApiAdapter } = require('/opt/mxv-checklist/backend/dist/modules/ingress/adapters/coreccp-api.adapter');
const { SystemSettingsService } = require('/opt/mxv-checklist/backend/dist/modules/system-settings/system-settings.service');
const { decrypt } = require('/opt/mxv-checklist/backend/dist/shared/helpers/crypto');
const fs = require('fs');

async function testWithNestContext() {
  console.log('Bootstrapping NestJS Context on Ubuntu...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  
  const settingsService = app.get(SystemSettingsService);
  const rawCred = await settingsService.getSetting('bot_credentials_ccp', '');
  console.log('settingsService.getSetting(bot_credentials_ccp) length:', rawCred ? rawCred.length : 0);
  try {
    const dec = decrypt(rawCred);
    console.log('decrypt(rawCred) success! username:', JSON.parse(dec).username);
  } catch (err) {
    console.log('decrypt(rawCred) error:', err.message);
  }

  const adapter = app.get(CoreCcpApiAdapter);
  console.log('adapter.settingsService exists:', !!adapter['settingsService']);

  const testDir = '/tmp/test_ccp_download_nest_' + Date.now();
  console.log('Target outputDir:', testDir);

  const res = await adapter.download('CCP', {
    targetDate: '2026-10-16',
    outputDir: testDir,
    reportCodes: ['DSGD_CCP'],
    mode: 'REST_API'
  });

  console.log('=== TEST RESULT ===');
  console.log('Result success:', res.success);
  console.log('Result files count:', res.files.length);
  res.files.forEach(f => {
    console.log(' - File:', f.fileName, 'Size:', f.fileSize, 'Path:', f.absolutePath);
  });

  if (fs.existsSync(testDir)) {
    const files = fs.readdirSync(testDir);
    console.log('Files on disk in outputDir:', files);
  }

  await app.close();
}

testWithNestContext().catch(err => {
  console.error('Nest Context test failed:', err);
  process.exit(1);
});
`;

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); return; }
    const stream = sftp.createWriteStream('/tmp/test_adapter_nest.js');
    stream.write(scriptContent);
    stream.end(() => {
      conn.exec('node /tmp/test_adapter_nest.js', (err2, stream2) => {
        if (err2) { console.error(err2); conn.end(); return; }
        stream2.on('data', d => process.stdout.write(d.toString()));
        stream2.stderr.on('data', d => process.stderr.write(d.toString()));
        stream2.on('close', () => conn.end());
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
