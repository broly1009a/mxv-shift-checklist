const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));
const conn = new Client();
conn.on('ready', () => {
  const code = `
require('/opt/mxv-checklist/backend/node_modules/dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { NestFactory } = require('/opt/mxv-checklist/backend/node_modules/@nestjs/core');
const { AppModule } = require('/opt/mxv-checklist/backend/dist/app.module');
const { SystemSettingsService } = require('/opt/mxv-checklist/backend/dist/modules/system-settings/system-settings.service');
const { resolveStoragePathCrossPlatform } = require('/opt/mxv-checklist/backend/dist/modules/bot-engine/helpers/bot-path.helper');
const { decrypt } = require('/opt/mxv-checklist/backend/dist/shared/helpers/crypto');
const path = require('path');
const fs = require('fs');

async function test() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const settingsService = app.get(SystemSettingsService);
  const credCcpRaw = await settingsService.getSetting('bot_credentials_ccp', '');
  let ccpOutputDirFromCreds = '';
  if (credCcpRaw) {
    try {
      const p = JSON.parse(decrypt(credCcpRaw));
      if (p.outputDir) ccpOutputDirFromCreds = p.outputDir;
    } catch(e){}
  }
  const defaultCcpPath = path.join(process.cwd(), 'data', 'backup', 'ccp', 'futures');
  const ccpBackupBase = resolveStoragePathCrossPlatform(
    ccpOutputDirFromCreds || (await settingsService.getSetting('bot_backup_path_ccp', '')) || defaultCcpPath
  );
  const subFolder = path.join('2026', 'T10.2026', '16.10');
  const ccpDailyPath = path.join(
    ccpBackupBase.replace(/Backup CCP/i, 'TradingCheck/CCP'),
    subFolder
  );
  console.log('ccpDailyPath:', ccpDailyPath);
  console.log('Directory exists:', fs.existsSync(ccpDailyPath));
  if (fs.existsSync(ccpDailyPath)) {
    const list = fs.readdirSync(ccpDailyPath);
    console.log('Files currently in ccpDailyPath:');
    list.forEach(f => {
      const s = fs.statSync(path.join(ccpDailyPath, f));
      console.log(' - ' + f + ': ' + s.size + ' bytes, modified: ' + s.mtime.toISOString());
    });
  }
  await app.close();
}
test().catch(console.error);
`;

  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); return; }
    const ws = sftp.createWriteStream('/tmp/check_ccp_path.js');
    ws.write(code);
    ws.end(() => {
      conn.exec('node /tmp/check_ccp_path.js', (err2, stream) => {
        if (err2) { console.error(err2); conn.end(); return; }
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => conn.end());
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
