const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';

// Mock findLatestFile from service
function findLatestFile(dir, regex) {
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
  return matching.length > 0 ? matching[0].path : null;
}

// Mock mergeCqgRawFiles from service
function mergeCqgRawFiles(dir, type) {
  if (!fs.existsSync(dir)) return null;
  const p1 = path.join(dir, `${type}1.xlsx`);
  const p2 = path.join(dir, `${type}2.xlsx`);
  if (fs.existsSync(p1) && fs.existsSync(p2)) {
    return path.join(dir, `${type}.xlsx`);
  }
  return null;
}

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  const settingsCol = db.collection('system_settings');
  const msBackupBase = await settingsCol.findOne({ key: 'bot_backup_path_ms' }).then(s => s ? s.value : 'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures');
  const cqgBackupBase = await settingsCol.findOne({ key: 'bot_backup_path_cqg' }).then(s => s ? s.value : 'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures');
  const acmBackupBase = msBackupBase.replace(/Backup MS\\Futures/i, 'Backup MS\\ACM');

  const tradingDate = new Date('2026-08-07');
  const year = tradingDate.getFullYear().toString();
  const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
  const day = String(tradingDate.getDate()).padStart(2, '0');
  const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
  
  const msDailyPath = path.join(msBackupBase, subFolder);
  const cqgDailyPath = path.join(cqgBackupBase, subFolder);
  const acmDailyPath = path.join(acmBackupBase, subFolder);

  console.log('--- PATH RESOLUTIONS ---');
  console.log(`msDailyPath: ${msDailyPath}`);
  console.log(`cqgDailyPath: ${cqgDailyPath}`);
  console.log(`acmDailyPath: ${acmDailyPath}`);

  const acmTradesPath = findLatestFile(acmDailyPath, /Nano|Fill/i);
  console.log(`Resolved acmTradesPath: ${acmTradesPath}`);

  const cqgFrPath =
    findLatestFile(cqgDailyPath, /^FR\.xlsx$/i) ||
    mergeCqgRawFiles(cqgDailyPath, 'FR') ||
    findLatestFile(cqgDailyPath, /FR/i);
  console.log(`Resolved cqgFrPath: ${cqgFrPath}`);

  const cqgPsPath =
    findLatestFile(cqgDailyPath, /^PS\.xlsx$/i) ||
    mergeCqgRawFiles(cqgDailyPath, 'PS') ||
    findLatestFile(cqgDailyPath, /Positions|PS/i);
  console.log(`Resolved cqgPsPath: ${cqgPsPath}`);

  await client.close();
}

main().catch(console.error);
