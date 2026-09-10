const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', async () => {
  const query = `
    const rec1 = db.clean_account_records.findOne({ _id: ObjectId("6a9e8f387900b1ed5215a39d") });
    print("=== RECORD 1 ===");
    print(JSON.stringify(rec1, null, 2));

    const rec2 = db.clean_account_records.findOne({ _id: ObjectId("6a9fc05511c1e4c8715dc183") });
    print("=== RECORD 2 ===");
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
