const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', async () => {
  const query = `
    const rec3 = db.clean_account_records.findOne({ _id: ObjectId("6aa0db77d377b65b0d7777ac") });
    print("Record 3 ketLuan:", JSON.stringify(rec3.ketLuan));
    print("Record 3 canCuoc:", JSON.stringify(rec3.canCuoc));
    print("Record 3 hopDong:", JSON.stringify(rec3.hopDong));
    print("Record 3 batchDate:", rec3.batchDate);
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
