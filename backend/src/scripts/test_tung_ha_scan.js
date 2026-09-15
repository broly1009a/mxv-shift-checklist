const { Client } = require('ssh2');

const conn = new Client();

function runRemoteCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', d => out += d);
      stream.stderr.on('data', d => out += d);
      stream.on('close', () => resolve(out));
    });
  });
}

conn.on('ready', async () => {
  console.log('Connected to Ubuntu 10.0.0.26');
  
  // 1. Check Hoang Thanh Tung (003C2886699)
  console.log('\n--- 1. Testing HOANG THANH TUNG (003C2886699) ---');
  const filesTung = await runRemoteCommand(conn, 'find "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem" -name "*003C2886699*"');
  console.log('Found path for Tung:\n', filesTung.trim());
  
  const tungDir = filesTung.trim().split('\n')[0];
  if (tungDir) {
    const listFiles = await runRemoteCommand(conn, `ls -la "${tungDir}"`);
    console.log('Files in Tung dir:\n', listFiles.trim());
    
    const cmdTung = `python3 /opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py --code 003C2886699 --front "${tungDir}/front.jpg" --back "${tungDir}/back.jpg" --name "HOÀNG THANH TÙNG"`;
    console.log('Running:', cmdTung);
    const outTung = await runRemoteCommand(conn, cmdTung);
    console.log('Tung result:\n', outTung);
  }

  // 2. Check Le Hoang Ha (003C4707772)
  console.log('\n--- 2. Testing LE HOANG HA (003C4707772) ---');
  const filesHa = await runRemoteCommand(conn, 'find "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem" -name "*003C4707772*"');
  console.log('Found path for Ha:\n', filesHa.trim());
  
  const haDir = filesHa.trim().split('\n')[0];
  if (haDir) {
    const listFiles = await runRemoteCommand(conn, `ls -la "${haDir}"`);
    console.log('Files in Ha dir:\n', listFiles.trim());
    
    const cmdHa = `python3 /opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py --code 003C4707772 --front "${haDir}/front.jpg" --back "${haDir}/back.jpg" --name "LÊ HOÀNG HÀ"`;
    console.log('Running:', cmdHa);
    const outHa = await runRemoteCommand(conn, cmdHa);
    console.log('Ha result:\n', outHa);
  }

  conn.end();
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
