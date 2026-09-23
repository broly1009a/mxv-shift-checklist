const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec("mongosh mxv_shift_checklist --quiet --eval 'JSON.stringify(db.bot_jobs.find({ _id: { $gte: ObjectId(\"6aacb9d60000000000000000\"), $lte: ObjectId(\"6aacb9d6ffffffffffffffff\") } }).toArray())'", (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
