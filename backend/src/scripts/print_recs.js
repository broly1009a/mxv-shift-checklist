const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', async () => {
  const query = `
    const rec3 = db.clean_account_records.findOne({ _id: ObjectId("6aa0db77d377b65b0d7777ac") });
    print("=== RECORD 3 (2026-09-09) ===");
    print(JSON.stringify(rec3, null, 2));

    const rec2 = db.clean_account_records.findOne({ _id: ObjectId("6a9fbfdc11c1e4c8715dc16a") });
    print("=== RECORD 2 (2026-09-08) ===");
    print(JSON.stringify(rec2, null, 2));
  `;
  conn.exec(`mongosh mxv_shift_checklist --quiet --eval '${query.replace(/\n/g, " ")}'`, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
