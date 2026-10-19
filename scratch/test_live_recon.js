const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));
const conn = new Client();
conn.on('ready', () => {
  const code = `
require('/opt/mxv-checklist/backend/node_modules/dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { NestFactory } = require('/opt/mxv-checklist/backend/node_modules/@nestjs/core');
const { AppModule } = require('/opt/mxv-checklist/backend/dist/app.module');
const { KlgdReconService } = require('/opt/mxv-checklist/backend/dist/modules/trading-ops/services/klgd-recon.service');

async function run() {
  console.log('Bootstrapping NestJS Context for KLGD Recon...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const reconService = app.get(KlgdReconService);

  const res = await reconService.runAutoCheckKLGD(new Date('2026-10-16'));
  console.log('=== KLGD RECON RESULT ===');
  console.log('Passed:', res.passed);
  console.log('Totals:', JSON.stringify(res.totals, null, 2));
  console.log('Mismatched trades count:', (res.mismatchedTrades || []).length);
  if (res.mismatchedTrades && res.mismatchedTrades.length > 0) {
    console.log('First 5 mismatched:', res.mismatchedTrades.slice(0, 5));
  }

  await app.close();
}
run().catch(console.error);
`;

  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); return; }
    const ws = sftp.createWriteStream('/tmp/test_live_recon.js');
    ws.write(code);
    ws.end(() => {
      conn.exec('node /tmp/test_live_recon.js', (err2, stream) => {
        if (err2) { console.error(err2); conn.end(); return; }
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => conn.end());
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
