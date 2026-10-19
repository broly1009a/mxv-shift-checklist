const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));

const scriptContent = `
const { CoreCcpApiAdapter } = require('/opt/mxv-checklist/backend/dist/modules/ingress/adapters/coreccp-api.adapter');
const path = require('path');
const fs = require('fs');

async function testAdapter() {
  console.log('Testing CoreCcpApiAdapter on Ubuntu 10.0.0.26...');
  const adapter = new CoreCcpApiAdapter();
  
  const testDir = '/tmp/test_ccp_download_' + Date.now();
  console.log('Target outputDir:', testDir);

  const res = await adapter.download('CCP', {
    targetDate: '2026-10-16',
    outputDir: testDir,
    reportCodes: ['DSGD_CCP'],
    mode: 'REST_API'
  });

  console.log('Result success:', res.success);
  console.log('Result files count:', res.files.length);
  res.files.forEach(f => {
    console.log(' - File:', f.fileName, 'Size:', f.fileSize, 'Path:', f.absolutePath);
  });

  if (fs.existsSync(testDir)) {
    const files = fs.readdirSync(testDir);
    console.log('Files on disk in outputDir:', files);
  }
}

testAdapter().catch(err => {
  console.error('Test adapter failed:', err);
  process.exit(1);
});
`;

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); return; }
    const stream = sftp.createWriteStream('/tmp/test_adapter_live.js');
    stream.write(scriptContent);
    stream.end(() => {
      conn.exec('node /tmp/test_adapter_live.js', (err2, stream2) => {
        if (err2) { console.error(err2); conn.end(); return; }
        stream2.on('data', d => process.stdout.write(d.toString()));
        stream2.stderr.on('data', d => process.stderr.write(d.toString()));
        stream2.on('close', () => conn.end());
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
