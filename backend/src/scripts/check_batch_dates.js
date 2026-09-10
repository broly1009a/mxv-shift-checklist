const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', async () => {
  const query = `
    const dates = db.clean_account_records.distinct("batchDate");
    print("Distinct batchDates in clean_account_records:", JSON.stringify(dates));
    dates.forEach(d => {
      const count = db.clean_account_records.countDocuments({ batchDate: d });
      const lech = db.clean_account_records.countDocuments({ batchDate: d, "ketLuan.trangThai": "LECH" });
      const khop = db.clean_account_records.countDocuments({ batchDate: d, "ketLuan.trangThai": "KHOP" });
      print("  Date:", d, "Total:", count, "Khop:", khop, "Lech:", lech);
    });
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
