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
const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");

const codes = ${JSON.stringify(codes)};

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const cleanCol = db.collection("clean_account_records");
  const rawCol = db.collection("raw_account_mails");

  // Also search for 085C0947827 in raw_account_mails or clean
  const rec085 = await cleanCol.findOne({ $or: [{ maTKGD: /0947827/ }, { 'ms.hoVaTen': /THỊNH/i }] });
  console.log("085_SEARCH:", rec085 ? rec085.maTKGD : "NOT_FOUND");

  for (const c of codes) {
    const r = await cleanCol.findOne({ $or: [{ maTKGD: c }, { maTKGDBase: c }, { maTKGD: new RegExp(c) }] });
    if (!r) continue;
    console.log("=== CODE:", c, "rawMailId:", r.rawMailId);
    
    // Check raw_account_mails
    let raw = null;
    if (r.rawMailId) {
      raw = await rawCol.findOne({ _id: new ObjectId(r.rawMailId) });
    }
    if (!raw) {
      raw = await rawCol.findOne({ $or: [{ subject: new RegExp(c) }, { body: new RegExp(c) }] });
    }

    if (raw) {
      console.log("  RAW_SUBJECT:", raw.subject);
      console.log("  RAW_FROM:", raw.from?.emailAddress?.address || raw.sender);
      console.log("  RAW_DATE:", raw.receivedDateTime);
      const atts = raw.attachments || [];
      console.log("  ATTACHMENTS (" + atts.length + "):");
      for (const a of atts) {
        console.log("    - name:", a.name, "| path:", a.localPath || a.savedPath || a.path, "| size:", a.size);
      }
    } else {
      console.log("  RAW_MAIL_NOT_FOUND");
    }

    // Search disk for files matching code
    const bases = [
      "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem",
      "/opt/mxv-checklist/backend/data/temp_tkgd_attachments"
    ];
    for (const b of bases) {
      if (!fs.existsSync(b)) continue;
      try {
        const foundOnDisk = [];
        function searchDir(d, depth=0) {
          if (depth > 3) return;
          try {
            const files = fs.readdirSync(d);
            for (const f of files) {
              const full = path.join(d, f);
              if (fs.statSync(full).isDirectory()) {
                if (f.includes(c)) foundOnDisk.push(full);
                else searchDir(full, depth + 1);
              } else if (f.includes(c)) {
                foundOnDisk.push(full);
              }
            }
          } catch {}
        }
        searchDir(b);
        if (foundOnDisk.length) console.log("  DISK_FILES (" + b + "):", foundOnDisk);
      } catch {}
    }
  }
  await client.close();
}
main().catch(console.error);
'
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(remoteScript, (err, stream) => {
    if (err) { conn.end(); return; }
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 15000,
});
