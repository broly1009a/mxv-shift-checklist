const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));
const conn = new Client();
conn.on('ready', () => {
  const code = `
const ExcelJS = require('/opt/mxv-checklist/backend/node_modules/exceljs');
const path = require('path');
const fs = require('fs');

async function test() {
  const tmpDirs = fs.readdirSync('/tmp').filter(d => d.startsWith('test_ccp_download_nest_'));
  tmpDirs.sort();
  const latestDir = '/tmp/' + tmpDirs[tmpDirs.length - 1];
  console.log('Reading from:', latestDir);

  const filePath = path.join(latestDir, 'DSGD CCP.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];
  console.log('Worksheet name:', ws.name);
  console.log('Total rows:', ws.rowCount);

  const header = ws.getRow(1).values;
  console.log('Headers:', JSON.stringify(header));
}
test().catch(console.error);
`;

  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); return; }
    const ws = sftp.createWriteStream('/tmp/inspect_fresh_ccp.js');
    ws.write(code);
    ws.end(() => {
      conn.exec('node /tmp/inspect_fresh_ccp.js', (err2, stream) => {
        if (err2) { console.error(err2); conn.end(); return; }
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => conn.end());
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
