const path = require('path');
const { Client } = require(path.join(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connection established to 10.0.0.26.');
  const cmd = `mongosh --eval '
    const targetDbs = ["mxv_shift_checklist", "trading_mxv", "checklist"];
    for (const dbName of targetDbs) {
      const currentDb = db.getSiblingDB(dbName);
      console.log("\\n========================================================");
      console.log("CHI TIẾT COLLECTIONS TRONG DATABASE: [" + dbName + "]");
      console.log("========================================================");
      const colls = currentDb.getCollectionNames();
      const statsList = [];
      for (const c of colls) {
        const count = currentDb.getCollection(c).countDocuments();
        let sizeMB = 0;
        try {
          const stats = currentDb.getCollection(c).stats();
          sizeMB = (stats.size / 1024 / 1024).toFixed(3);
        } catch (e) {}
        statsList.push({ name: c, count: count, sizeMB: sizeMB });
      }

      statsList.sort((a, b) => b.count - a.count);
      for (const s of statsList) {
        console.log(s.name.padEnd(35) + " | Docs: " + String(s.count).padStart(8) + " | Size: " + String(s.sizeMB).padStart(8) + " MB");
      }
    }
  ' --quiet`;

  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', (code) => {
      conn.end();
    });
  });
}).on('error', (err) => {
  console.error('SSH Error:', err);
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 30000,
});
