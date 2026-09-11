const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const script = `
    python3 -c "
import urllib.request, ssl, re
ctx = ssl.create_default_context()
req = urllib.request.Request('https://acm-etp.acmmex.com/exchange/index.html', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, context=ctx) as r:
        html = r.read().decode('utf-8')
        scripts = re.findall(r'src=[\"\']([^\"\']+)[\"\']', html)
        print('Scripts:', scripts)
except Exception as e:
    print('Error:', e)
"
  `;
  conn.exec(script, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
