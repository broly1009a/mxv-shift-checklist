const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  const settingsCol = db.collection('system_settings');
  const msBackupBase = await settingsCol.findOne({ key: 'bot_backup_path_ms' }).then(s => s ? s.value : 'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures');
  const cqgBackupBase = await settingsCol.findOne({ key: 'bot_backup_path_cqg' }).then(s => s ? s.value : 'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures');

  const tradingDate = new Date('2026-08-07');
  const year = tradingDate.getFullYear().toString();
  const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
  const day = String(tradingDate.getDate()).padStart(2, '0');
  const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
  
  const msDailyPath = path.join(msBackupBase, subFolder);
  const cqgDailyPath = path.join(cqgBackupBase, subFolder);

  console.log('--- SOD FILES LOCATIONS ---');
  console.log(`MS Daily Path: ${msDailyPath}`);
  console.log(`CQG Daily Path: ${cqgDailyPath}`);

  const qltkgdPath = path.join(msDailyPath, 'QLTKGD.xlsx');
  if (fs.existsSync(qltkgdPath)) {
    const stat = fs.statSync(qltkgdPath);
    console.log(`- QLTKGD.xlsx exists: ${qltkgdPath}`);
    console.log(`  Modified: ${stat.mtime}`);
  } else {
    console.log(`- QLTKGD.xlsx DOES NOT EXIST`);
  }

  // Find Accounts_Balances in cqgDailyPath or msDailyPath
  const findLatestFile = (dir, regex) => {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir);
    const matching = files
      .filter(f => regex.test(f))
      .map(f => {
        const fp = path.join(dir, f);
        const stat = fs.statSync(fp);
        return { path: fp, mtime: stat.mtime };
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return matching.length > 0 ? matching[0] : null;
  };

  const balInCqg = findLatestFile(cqgDailyPath, /Accounts_Balances/i);
  if (balInCqg) {
    console.log(`- Accounts_Balances in CQG folder: ${balInCqg.path}`);
    console.log(`  Modified: ${balInCqg.mtime}`);
  } else {
    console.log(`- Accounts_Balances in CQG folder: NOT FOUND`);
  }

  const balInMs = findLatestFile(msDailyPath, /Accounts_Balances/i);
  if (balInMs) {
    console.log(`- Accounts_Balances in MS folder: ${balInMs.path}`);
    console.log(`  Modified: ${balInMs.mtime}`);
  } else {
    console.log(`- Accounts_Balances in MS folder: NOT FOUND`);
  }

  await client.close();
}

main().catch(console.error);
