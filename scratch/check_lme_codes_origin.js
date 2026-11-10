const { Client } = require('../backend/node_modules/ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`node -e '
    const mongoose = require("/opt/mxv-checklist/backend/node_modules/mongoose");
    mongoose.connect("mongodb://127.0.0.1:27017/mxv_checklist").then(async () => {
      const s = await mongoose.connection.db.collection("system_settings").findOne({ key: "ms_commodities_catalog_cache" });
      if (s && s.value) {
        const parsed = JSON.parse(s.value);
        console.log("=== cqgLme (subType=L) ===");
        for (const it of parsed.cqgLme || []) {
          console.log(it.commodityCode, "| shortName:", it.shortName, "| fullName:", it.fullName, "| exchange:", it.exchange);
        }
        console.log("=== Steel LME in cqgFutures (subType=F, exchange=LME) ===");
        for (const it of parsed.cqgFutures || []) {
          if (it.exchange === "LME") {
            console.log(it.commodityCode, "| shortName:", it.shortName, "| fullName:", it.fullName, "| exchange:", it.exchange);
          }
        }
      }
      process.exit(0);
    });
  '`, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d).on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });

