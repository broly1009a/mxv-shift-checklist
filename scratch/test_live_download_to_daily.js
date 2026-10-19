const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));
const conn = new Client();
conn.on('ready', () => {
  const code = `
require('/opt/mxv-checklist/backend/node_modules/dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { NestFactory } = require('/opt/mxv-checklist/backend/node_modules/@nestjs/core');
const { AppModule } = require('/opt/mxv-checklist/backend/dist/app.module');
const { CoreCcpApiAdapter } = require('/opt/mxv-checklist/backend/dist/modules/ingress/adapters/coreccp-api.adapter');
const path = require('path');
const fs = require('fs');

async function run() {
  console.log('Bootstrapping NestJS Context...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const adapter = app.get(CoreCcpApiAdapter);

  const targetDir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/CCP/Futures/2026/T10.2026/16.10';
  console.log('Target daily directory:', targetDir);

  const res = await adapter.download('CCP', {
    targetDate: '2026-10-16',
    outputDir: targetDir,
    reportCodes: ['DSGD_CCP'],
    mode: 'REST_API',
  });

  console.log('=== DOWNLOAD RESULT ===');
  console.log('Success:', res.success);
  console.log('Files count:', res.files.length);
  res.files.forEach(f => {
    console.log(' - ' + f.fileName + ': ' + f.fileSize + ' bytes, path: ' + f.absolutePath);
  });

  console.log('=== VERIFYING ON DISK ===');
  const dsgdCcpPath = path.join(targetDir, 'DSGD CCP.xlsx');
  const dsgdDailyPath = path.join(targetDir, 'DSGD_16.10.2026.xlsx');
  if (fs.existsSync(dsgdCcpPath)) {
    const s1 = fs.statSync(dsgdCcpPath);
    console.log('DSGD CCP.xlsx size:', s1.size, 'mtime:', s1.mtime.toISOString());
  }
  if (fs.existsSync(dsgdDailyPath)) {
    const s2 = fs.statSync(dsgdDailyPath);
    console.log('DSGD_16.10.2026.xlsx size:', s2.size, 'mtime:', s2.mtime.toISOString());
  }

  await app.close();
}
run().catch(console.error);
`;

  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); return; }
    const ws = sftp.createWriteStream('/tmp/test_download_daily.js');
    ws.write(code);
    ws.end(() => {
      conn.exec('node /tmp/test_download_daily.js', (err2, stream) => {
        if (err2) { console.error(err2); conn.end(); return; }
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => conn.end());
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
