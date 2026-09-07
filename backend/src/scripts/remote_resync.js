const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected to Ubuntu. Triggering sync-mail...');
  conn.exec('curl -s -X POST http://localhost:3001/api/v1/tkgd/sync-mail -H "Content-Type: application/json" -d "{\\"batchDate\\":\\"2026-09-07\\"}"', (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    let out = '';
    stream.on('data', chunk => out += chunk.toString());
    stream.stderr.on('data', errChunk => console.error('STDERR:', errChunk.toString()));
    stream.on('close', (code) => {
      console.log('Exit code:', code);
      console.log('API Response:\n', out);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
