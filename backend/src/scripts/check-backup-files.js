const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

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

  console.log(`--- DIRECTORY AUDIT FOR 2026-08-07 ---`);
  console.log(`MS Path: ${msDailyPath}`);
  if (fs.existsSync(msDailyPath)) {
    console.log('MS Files:', fs.readdirSync(msDailyPath));
  } else {
    console.log('MS Path does not exist!');
  }

  console.log(`CQG Path: ${cqgDailyPath}`);
  if (fs.existsSync(cqgDailyPath)) {
    console.log('CQG Files:', fs.readdirSync(cqgDailyPath));
  } else {
    console.log('CQG Path does not exist!');
  }

  await client.close();
}

main().catch(console.error);
