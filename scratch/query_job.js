const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`mongosh mxv_shift_checklist --eval 'JSON.stringify(db.bot_jobs.find({_id: ObjectId("6ad201f9af5a4ecb048e56ef")}, {logs: 1, errors: 1, status: 1}).toArray())'`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      try {
        const raw = out.split('\n').filter(l => l.startsWith('[')).join('');
        const jobs = JSON.parse(raw);
        console.log('Status:', jobs[0]?.status);
        console.log('Errors:', jobs[0]?.errors);
        console.log('Logs:');
        console.log((jobs[0]?.logs || []).join('\n'));
      } catch (e) {
        console.log('Raw output:', out);
      }
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });
