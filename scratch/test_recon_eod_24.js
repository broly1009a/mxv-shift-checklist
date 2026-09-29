const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
  const nodeScript = `
    const { NestFactory } = require('@nestjs/core');
    const { AppModule } = require('./dist/app.module');
    const { ReconciliationService } = require('./dist/modules/reconciliation/reconciliation.service');

    async function run() {
      const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
      const reconService = app.get(ReconciliationService);

      console.log('Testing runAutoCheckEodMm for session 2026-09-24...');
      const targetDate = new Date('2026-09-24T00:00:00Z');
      const result = await reconService.runAutoCheckEodMm(targetDate);

      console.log('Total negative accounts:', (result.eodResult?.negativeBalanceAccs?.length || 0) + (result.eodResult?.negativeIMRAcc?.length || 0));
      console.log('Total mismatched EOD:', result.eodResult?.mismatchedEOD?.length || 0);

      if (result.eodResult?.mismatchedEOD?.length > 0) {
        console.log('Mismatched list:');
        result.eodResult.mismatchedEOD.forEach(m => {
          console.log('- TK:', m.maTKGD, 'calc:', m.calculatedBalance, 'eod:', m.eodBalance, 'differ:', m.differ);
        });
      }

      await app.close();
      process.exit(0);
    }
    run().catch(console.error);
  `;
  const b64 = Buffer.from(nodeScript).toString('base64');
  const cmd = `cd /opt/mxv-checklist/backend && node -e "eval(Buffer.from('${b64}', 'base64').toString())"`;
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    let output = '';
    stream.on('data', (d) => { output += d.toString(); });
    stream.stderr.on('data', (d) => { output += d.toString(); });
    stream.on('close', () => {
      console.log(output);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
