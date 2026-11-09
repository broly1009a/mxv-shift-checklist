const path = require('path');
const { Client } = require(path.join(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connection established to 10.0.0.26.');

  const backupDir = '/home/mxvadmin/backups/mongodb';
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const backupArchive = `${backupDir}/mongodb_backup_full_${timestamp}.archive.gz`;

  const script = `
    set -e
    echo "=== 1. TẠO THƯ MỤC LƯU TRỮ BACKUP ==="
    mkdir -p ${backupDir}

    echo "=== 2. THỰC THI MONGODUMP TOÀN BỘ CƠ SỞ DỮ LIỆU ==="
    mongodump --archive=${backupArchive} --gzip

    echo "=== 3. KIỂM TRA FILE BACKUP VỪA TẠO ==="
    ls -lh ${backupArchive}

    echo "=== 4. XÓA AN TOÀN CÁC COLLECTIONS RỖNG (0 DOCS) TRONG mxv_shift_checklist ==="
    mongosh mxv_shift_checklist --eval '
      const emptyColls = [
        "test",
        "systemsettings",
        "shiftlogs",
        "botjobs",
        "settings",
        "tkgdaccountopenings",
        "notification_logs",
        "exchange_rates",
        "special_account_monthly_tracking"
      ];

      for (const collName of emptyColls) {
        const count = db.getCollection(collName).countDocuments();
        if (count === 0) {
          const res = db.getCollection(collName).drop();
          console.log("  [DROP 0-DOC] " + collName.padEnd(35) + ": " + (res ? "THÀNH CÔNG" : "THẤT BẠI"));
        } else {
          console.log("  [CẢNH BÁO - BỎ QUA] " + collName + " có " + count + " documents, TUYỆT ĐỐI KHÔNG XÓA!");
        }
      }
    ' --quiet

    echo "=== 5. XÓA 2 DATABASE CŨ ĐÃ ĐƯỢC BACKUP (trading_mxv, checklist) ==="
    mongosh --eval '
      console.log("  Drop database: trading_mxv -> " + db.getSiblingDB("trading_mxv").dropDatabase().ok);
      console.log("  Drop database: checklist -> " + db.getSiblingDB("checklist").dropDatabase().ok);
    ' --quiet

    echo "=== 6. KIỂM TOÁN LẠI TẤT CẢ COLLECTIONS SAU KHI LÀM SẠCH ==="
    mongosh --eval '
      const dbs = db.adminCommand("listDatabases").databases;
      console.log("\\n--- DANH SÁCH DATABASE HIỆN TẠI ---");
      for (const d of dbs) {
        console.log("- " + d.name + " (" + (d.sizeOnDisk / 1024 / 1024).toFixed(2) + " MB)");
      }

      console.log("\\n--- COLLECTIONS TRONG mxv_shift_checklist SAU LÀM SẠCH ---");
      const currentDb = db.getSiblingDB("mxv_shift_checklist");
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
    ' --quiet
  `;

  conn.exec(script, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', (code) => {
      console.log(`\n=== QUÁ TRÌNH BACKUP & LÀM SẠCH KẾT THÚC VỚI EXIT CODE: ${code} ===`);
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
