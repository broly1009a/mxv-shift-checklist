const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection established to Ubuntu 10.0.0.26');
  
  const cmd = 'echo "MxV!,#2o26" | sudo -S apt-get update && echo "MxV!,#2o26" | sudo -S apt-get install -y tesseract-ocr tesseract-ocr-vie libzbar0 && pip3 install --break-system-packages pdfplumber pymupdf opencv-python-headless pyzbar zxing-cpp pillow';
  
  console.log('Running installation on Ubuntu...');
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', (code) => {
      console.log(`\nCommand exited with code ${code}`);
      
      // Verify packages
      conn.exec('python3 -c "for m in [\'pdfplumber\', \'fitz\', \'cv2\', \'pyzbar\', \'zxingcpp\', \'PIL\', \'pytesseract\']: import importlib; print(m, \'OK\' if importlib.util.find_spec(m) else \'MISSING\')"', (e2, s2) => {
        let out = '';
        s2.on('data', (d) => (out += d.toString()));
        s2.on('close', () => {
          console.log('\nVerification of Python packages on Ubuntu:\n', out);
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
  readyTimeout: 15000,
});
