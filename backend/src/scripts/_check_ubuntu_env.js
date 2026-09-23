const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  const cmd = `
    echo "=== 1. CHECK PYTHON PACKAGES ON UBUNTU ==="
    python3 -c "
for pkg in ['fitz', 'pytesseract', 'PIL', 'pdfplumber', 'google.generativeai', 'requests']:
    try:
        __import__(pkg)
        print('  [OK]', pkg)
    except ImportError as e:
        print('  [MISSING]', pkg, e)
"
    echo "=== 2. CHECK GEMINI_API_KEY IN ENV ==="
    grep -i "GEMINI" /opt/mxv-checklist/backend/.env 2>/dev/null || echo "  No GEMINI in .env"
    echo "=== 3. CHECK PM2 ENV ==="
    pm2 env 0 | grep -i "gemini" || echo "  No GEMINI in PM2 env"
  `;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
