const { Client } = require('ssh2');

const codes = [
  '003C2311200', '085C0947827', '003C0879444', '003C0534241',
  '003C1564927', '003C0807375', '003C1731326', '003C1684879',
  '003C6550243', '003C1684184', '003C1669379', '003C0094629',
  '003C9052476', '003C1719053'
];

const remoteScript = `
cd /opt/mxv-checklist/backend && node -e '
require("dotenv").config({ path: "/opt/mxv-checklist/backend/.env" });
const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const codes = ${JSON.stringify(codes)};

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const col = db.collection("clean_account_records");

  console.log("=== CHECKING 14 ACCOUNTS ON UBUNTU MONGO ===");
  for (const c of codes) {
    const r = await col.findOne({ maTKGD: c });
    if (!r) {
      // try regex or maTKGDBase
      const r2 = await col.findOne({ $or: [{ maTKGDBase: c }, { maTKGD: new RegExp(c) }] });
      if (r2) {
        printRec(c, r2);
      } else {
        console.log("NOT_FOUND:", c);
      }
    } else {
      printRec(c, r);
    }
  }
  await client.close();
}

function printRec(code, r) {
  console.log("-----------------------------------------");
  console.log("CODE:", code, "| ID:", r._id, "| STATUS:", r.reconciliationResult?.status || r.ketLuan?.status);
  console.log("CCCD_OCR:", JSON.stringify({
    hoVaTen: r.canCuoc?.hoVaTen,
    soCCCD: r.canCuoc?.soCCCD,
    ngaySinh: r.canCuoc?.ngaySinh,
    gioiTinh: r.canCuoc?.gioiTinh,
    ngayCap: r.canCuoc?.ngayCap,
    noiCap: r.canCuoc?.noiCap,
    queQuan: r.canCuoc?.queQuan,
    noiThuongTru: r.canCuoc?.noiThuongTru,
  }));
  console.log("MS_DATA:", JSON.stringify({
    hoVaTen: r.ms?.hoVaTen,
    soCMND: r.ms?.soCMND_HoChieu,
    ngaySinh: r.ms?.ngaySinh,
    ngayCap: r.ms?.ngayCap,
  }));
  console.log("IMAGE_PATHS:", JSON.stringify({
    anhMatTruocLocalPath: r.canCuoc?.anhMatTruocLocalPath,
    anhMatSauLocalPath: r.canCuoc?.anhMatSauLocalPath,
    anhMatTruocUrl: r.canCuoc?.anhMatTruocUrl,
    anhMatSauUrl: r.canCuoc?.anhMatSauUrl,
  }));
  console.log("MAIL_ATTACHMENTS:", JSON.stringify(
    (r.noiDungMail?.attachments || []).map(a => ({ name: a.name, path: a.localPath || a.savedPath }))
  ));
  console.log("RECON_ERRORS:", JSON.stringify(r.reconciliationResult?.criticalErrors || r.ketLuan?.criticalErrors || []));
}

main().catch(console.error);
'
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected to Ubuntu 10.0.0.26');
  conn.exec(remoteScript, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', (code) => {
      console.log('\nFinished with code:', code);
      conn.end();
    });
  });
}).on('error', (err) => {
  console.error('SSH error:', err);
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 15000,
});
