const fs = require('fs');
const path = require('path');

function findLatestFile(dirPath, pattern) {
  if (!fs.existsSync(dirPath)) return null;
  try {
    const files = fs.readdirSync(dirPath);
    const matched = files
      .filter(f => pattern.test(f) && !f.startsWith('~$'))
      .map(f => {
        const fp = path.join(dirPath, f);
        return { file: f, path: fp, mtime: fs.statSync(fp).mtime };
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return matched.length > 0 ? matched[0].path : null;
  } catch (err) {
    return null;
  }
}

const msBackupBase = 'C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures';
const targetDate = new Date('2026-07-23');
const year = targetDate.getFullYear().toString();
const month = String(targetDate.getMonth() + 1).padStart(2, '0');
const day = String(targetDate.getDate()).padStart(2, '0');
const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

const msDailyPath = path.join(msBackupBase, subFolder);
const cqgDailyPath = path.join(msBackupBase.replace(/Backup MS\\Futures/i, 'Backup MS\\CQG'), subFolder);
const acmDailyPath = path.join(msBackupBase.replace(/Backup MS\\Futures/i, 'Backup MS\\ACM'), subFolder);
const castDownloadsDir = path.join(process.cwd(), 'temp', 'cast-downloads');
const userDownloadsDir = 'C:\\Users\\hiepth\\Downloads';

const dsgdPath = path.join(msDailyPath, 'DSGD.xlsx');
const ttttPath = path.join(msDailyPath, 'TTTT.xlsx');

const acmTradesPath = findLatestFile(acmDailyPath, /Straits|ACM|Fill|Order/i)
  || findLatestFile(castDownloadsDir, /Straits|ACM|Fill|Order/i)
  || findLatestFile(userDownloadsDir, /Straits|ACM|Fill|Order/i);

const cqgFrPath = findLatestFile(cqgDailyPath, /FR|CQG/i)
  || findLatestFile(castDownloadsDir, /FR|CQG/i)
  || findLatestFile(userDownloadsDir, /^FR.*\.xlsx$/i)
  || findLatestFile(userDownloadsDir, /FR/i);

const cqgPsPath = findLatestFile(cqgDailyPath, /Positions|PS|CQG/i)
  || findLatestFile(castDownloadsDir, /Positions|PS|CQG/i)
  || findLatestFile(userDownloadsDir, /^PS.*\.xlsx$/i)
  || findLatestFile(userDownloadsDir, /Positions|PS/i);

console.log('DSGD path:', dsgdPath, 'Exists:', fs.existsSync(dsgdPath));
console.log('TTTT path:', ttttPath, 'Exists:', fs.existsSync(ttttPath));
console.log('ACM Trades path:', acmTradesPath);
console.log('CQG FR path:', cqgFrPath);
console.log('CQG PS path:', cqgPsPath);
