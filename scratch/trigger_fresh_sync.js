const { Client } = require(require('path').join(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const remoteCode = `
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('/opt/mxv-checklist/backend/dist/app.module');
const { MonthlyReportingService } = require('/opt/mxv-checklist/backend/dist/modules/trading-ops/services/reporting/monthly-reporting.service');

async function run() {
  console.log('Khoi tao NestJS Context de goi MonthlyReportingService...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(MonthlyReportingService);

  console.log('Goi syncFromBackupFolders(2026, 10)...');
  const res = await service.syncFromBackupFolders(2026, 10);
  console.log('Ket qua sync:', JSON.stringify(res, null, 2));

  console.log('Goi getMonthlyReport(2026, 10)...');
  const report = await service.getMonthlyReport(2026, 10);
  console.log('SUMMARY:', JSON.stringify(report.summary, null, 2));
  console.log('TOP 5 CQG:');
  (report.part1Members?.cqgMembers || []).slice(0, 5).forEach(m => {
    console.log('  STT ' + m.stt + ': [' + m.memberCode + '] ' + m.memberName + ' | T9: ' + m.prevMonthVolume + ' | T10: ' + m.currentMonthVolume + ' | Phien: ' + m.tradingDaysCount + ' | Dinh: ' + m.maxDayDate + ' (' + m.maxDayVolume + ')');
  });

  await app.close();
  process.exit(0);
}

run().catch(e => {
  console.error('Loi:', e);
  process.exit(1);
});
`;
    sftp.writeFile('/tmp/run_sync.js', remoteCode, (wErr) => {
      if (wErr) throw wErr;
      conn.exec('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/run_sync.js', (cErr, stream) => {
        if (cErr) throw cErr;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', (code) => {
          console.log('Script finished with code:', code);
          conn.end();
        });
      });
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
