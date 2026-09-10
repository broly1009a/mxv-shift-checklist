const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', async () => {
  const query = `
    const rec3 = db.clean_account_records.findOne({ _id: ObjectId("6aa0db77d377b65b0d7777ac") });
    print("Record 3 snapshots count:", rec3.snapshots?.length);
    const snaps = rec3.snapshots || [];
    for (let i = 0; i < snaps.length; i++) {
      const s = snaps[i];
      print("--- Snapshot " + i + " at " + s.snapshotAt + " action: " + s.action);
      print("   prev ketLuan: " + JSON.stringify(s.previousData?.ketLuan));
      print("   prev hopDong: " + JSON.stringify(s.previousData?.hopDong?.hoVaTen));
      print("   prev canCuoc: " + JSON.stringify(s.previousData?.canCuoc?.hoVaTen));
      print("   prev mail   : " + JSON.stringify(s.previousData?.noiDungMail?.tenTaiKhoan));
    }
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
