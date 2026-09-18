const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    node -e "
      const jwt = require('jsonwebtoken');
      const http = require('http');
      const dotenv = require('dotenv');
      dotenv.config({ path: '/opt/mxv-checklist/backend/.env' });

      const secret = process.env.JWT_SECRET || 'trading_mxv_secret_key_2026';
      // Tao token admin hop le
      const token = jwt.sign(
        { id: '6a0000000000000000000001', username: 'admin', role: 'ADMIN', permissions: ['ACCESS_AUTO_SHIFT'] },
        secret,
        { expiresIn: '1h' }
      );

      const options = {
        hostname: '127.0.0.1',
        port: 3001,
        path: '/api/v1/reconciliation/console-summary?date=2026-09-17&jobId=6aab0b84cbae7980bc5366a8',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          console.log('HTTP Status:', res.statusCode);
          try {
            const data = JSON.parse(raw);
            console.log('Root Keys:', Object.keys(data));
            console.log('data.klgd:', data.klgd);
            console.log('data.intraday totals:', data.intraday ? {
              ms: data.intraday.msVolume,
              cqg: data.intraday.cqgVolume,
              acm: data.intraday.acmVolume,
              nano: data.intraday.nanoVolume
            } : 'none');
          } catch (e) {
            console.error('Parse err:', e.message, raw.slice(0, 300));
          }
        });
      });
      req.on('error', console.error);
      req.end();
    "
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
