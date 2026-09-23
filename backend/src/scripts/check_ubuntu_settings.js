const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec("mongosh mxv_shift_checklist --quiet --eval 'JSON.stringify(db.system_settings.find().toArray())'", (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      try {
        const arr = JSON.parse(out);
        for (const s of arr) {
          if (/path|recon|ccp/i.test(s.key)) {
            console.log(s.key, '->', s.value);
          }
        }
      } catch (e) {
        console.log('Error parsing:', e.message, out);
      }
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
