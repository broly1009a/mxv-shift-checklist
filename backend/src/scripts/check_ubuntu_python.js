const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('python3 --version; which python3; which pip3; python3 -m pip --version', (err, stream) => {
    let out = '';
    stream.on('data', d => (out += d.toString()));
    stream.on('close', () => {
      console.log('Ubuntu Server Python status:\n', out);
      
      conn.exec('python3 -c "for m in [\'openpyxl\', \'pdfplumber\', \'fitz\', \'cv2\', \'pyzbar\', \'zxingcpp\', \'PIL\', \'pytesseract\']: import importlib; print(m, \'OK\' if importlib.util.find_spec(m) else \'MISSING\')"', (err2, stream2) => {
        let out2 = '';
        stream2.on('data', d => (out2 += d.toString()));
        stream2.on('close', () => {
          console.log('\nPackages on Ubuntu:\n', out2);
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
  readyTimeout: 10000,
});
