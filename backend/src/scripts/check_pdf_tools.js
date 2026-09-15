const { Client } = require('ssh2');

const remoteCmd = `
python3 -c "
import fitz
print('PyMuPDF is installed!')
" 2>/dev/null || echo "No fitz"

which unzip
which pdftoppm
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(remoteCmd, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => out += d);
    stream.on('close', code => {
      console.log('RESULT:\n', out);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});
