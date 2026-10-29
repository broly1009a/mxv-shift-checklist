const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteCode = `
    const { NestFactory } = require('@nestjs/core');
    const { AppModule } = require('./dist/app.module');
    const { CcpEodService } = require('./dist/modules/trading-ops/services/recon/ccp-eod.service');

    async function bootstrap() {
      const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
      const service = app.get(CcpEodService);
      console.log('Running runAutoCheckEodCcp for 2026-10-29...');
      const res = await service.runAutoCheckEodCcp(new Date('2026-10-29'));
      console.log('Total accounts:', res.totalAccounts);
      console.log('Mismatched count:', res.mismatchedCount);
      console.log('Mismatched EOD:', JSON.stringify(res.mismatchedEOD, null, 2));
      console.log('Files used:', JSON.stringify(res.filesUsed, null, 2));
      await app.close();
      process.exit(0);
    }
    bootstrap().catch(err => {
      console.error(err);
      process.exit(1);
    });
  `;

  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.writeFile('/opt/mxv-checklist/backend/test_live_eod.js', remoteCode, (wErr) => {
      if (wErr) throw wErr;
      conn.exec('cd /opt/mxv-checklist/backend && node test_live_eod.js', (cErr, stream) => {
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
