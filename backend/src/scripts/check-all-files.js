const fs = require('fs');
const path = require('path');

const msBackupBase = 'C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures';
const targetDate = new Date('2026-07-23');
const year = targetDate.getFullYear().toString();
const month = String(targetDate.getMonth() + 1).padStart(2, '0');
const day = String(tradingDate = targetDate.getDate()).toString().padStart(2, '0');
const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

const msDailyPath = path.join(msBackupBase, subFolder);
const cqgDailyPath = path.join(msBackupBase.replace(/Backup MS\\Futures/i, 'Backup MS\\CQG'), subFolder);
const acmDailyPath = path.join(msBackupBase.replace(/Backup MS\\Futures/i, 'Backup MS\\ACM'), subFolder);
const castDownloadsDir = path.join(process.cwd(), 'temp', 'cast-downloads');
const userDownloads = 'C:\\Users\\hiepth\\Downloads';

console.log('msDailyPath:', msDailyPath, fs.existsSync(msDailyPath) ? fs.readdirSync(msDailyPath) : 'NOT FOUND');
console.log('cqgDailyPath:', cqgDailyPath, fs.existsSync(cqgDailyPath) ? fs.readdirSync(cqgDailyPath) : 'NOT FOUND');
console.log('acmDailyPath:', acmDailyPath, fs.existsSync(acmDailyPath) ? fs.readdirSync(acmDailyPath) : 'NOT FOUND');
console.log('castDownloadsDir:', castDownloadsDir, fs.existsSync(castDownloadsDir) ? fs.readdirSync(castDownloadsDir) : 'NOT FOUND');

// Check user downloads for any FR or PS or CQG files
if (fs.existsSync(userDownloads)) {
  const cqgInDownloads = fs.readdirSync(userDownloads).filter(f => f.toLowerCase().includes('fr') || f.toLowerCase().includes('cqg') || f.toLowerCase().includes('ps') || f.toLowerCase().includes('positions'));
  console.log('User downloads CQG files:', cqgInDownloads);
}
