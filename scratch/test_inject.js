const { Client } = require(require('path').join(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const remoteCode = `
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('/opt/mxv-checklist/backend/dist/app.module');
const { SystemSettingsService } = require('/opt/mxv-checklist/backend/dist/modules/system-settings/system-settings.service');
const { MonthlyReportingService } = require('/opt/mxv-checklist/backend/dist/modules/trading-ops/services/reporting/monthly-reporting.service');

async function test() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const sys = app.get(SystemSettingsService);
  const rep = app.get(MonthlyReportingService);

  console.log('sys:', !!sys);
  console.log('rep.settingsService:', !!rep.settingsService);
  const ccpVal = await sys.getSetting('bot_backup_path_ccp', '');
  console.log('ccpVal from sys:', ccpVal);

  await app.close();
  process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
`;
    sftp.writeFile('/tmp/test_inject.js', remoteCode, (wErr) => {
      if (wErr) throw wErr;
      conn.exec('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/test_inject.js', (cErr, stream) => {
        if (cErr) throw cErr;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => conn.end());
      });
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

