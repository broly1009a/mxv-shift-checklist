const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const dsgdPath = path.join(__dirname, '../../TTTT-PS/07-07/DSGD.xlsx');
const frPath = path.join(__dirname, '../../TTTT-PS/07-07/FR.xlsx');

if (!fs.existsSync(dsgdPath) || !fs.existsSync(frPath)) {
  console.error('Files do not exist!');
  process.exit(1);
}

// Read DSGD
const dsgdWorkbook = XLSX.readFile(dsgdPath);
const dsgdSheet = dsgdWorkbook.Sheets[dsgdWorkbook.SheetNames[0]];
const dsgdRows = XLSX.utils.sheet_to_json(dsgdSheet, { header: 1 });
const dsgdHeader = dsgdRows[0].map(h => String(h || '').trim());

const dsgdAccountIdx = dsgdHeader.indexOf('Mã TKGD');
const dsgdSymbolIdx = dsgdHeader.indexOf('Mã HĐ');
const dsgdQtyIdx = dsgdHeader.indexOf('KL giao dịch');
const dsgdPriceIdx = dsgdHeader.indexOf('Giá khớp');

const dsgdData = [];
for (let i = 1; i < dsgdRows.length; i++) {
  const row = dsgdRows[i];
  if (!row || row.length === 0) continue;
  const maTKGD = String(row[dsgdAccountIdx] || '').trim();
  const maHD = String(row[dsgdSymbolIdx] || '').trim();
  const klGiaoDich = parseFloat(row[dsgdQtyIdx]) || 0;
  const giaKhop = parseFloat(row[dsgdPriceIdx]) || 0;
  
  dsgdData.push({
    maTKGD,
    maHD,
    klGiaoDich,
    giaKhop,
    combinedKey: `${maTKGD}${maHD}${giaKhop}`
  });
}

// Read FR
const frWorkbook = XLSX.readFile(frPath);
const frSheet = frWorkbook.Sheets[frWorkbook.SheetNames[0]];
const frRows = XLSX.utils.sheet_to_json(frSheet, { header: 1 });
const frHeader = frRows[0].map(h => String(h || '').trim());

const frAccountIdx = frHeader.indexOf('Account');
const frSymbolIdx = frHeader.indexOf('Symbol');
const frQtyIdx = frHeader.indexOf('Qty');
const frPriceIdx = frHeader.indexOf('Fill P');
const frTimeIdx = frHeader.indexOf('Time');

function parseCqgNumber(val) {
  if (val === undefined || val === null) return 0;
  let str = String(val).trim();
  if (str.includes(',')) {
    // If it has dot and comma, or just comma
    str = str.replace(/\./g, '').replace(/,/g, '.');
  }
  return parseFloat(str) || 0;
}

const frData = [];
for (let i = 1; i < frRows.length; i++) {
  const row = frRows[i];
  if (!row || row.length === 0) continue;
  const acc = String(row[frAccountIdx] || '').trim();
  const symbol = String(row[frSymbolIdx] || '').trim();
  const qty = parseCqgNumber(row[frQtyIdx]);
  const fillP = parseCqgNumber(row[frPriceIdx]);
  const time = String(row[frTimeIdx] || '').trim();

  let accountRaw = acc;
  if (accountRaw.endsWith('L') || accountRaw.endsWith('l')) accountRaw = accountRaw.slice(0, -1) + '-L';
  else if (accountRaw.endsWith('S') || accountRaw.endsWith('s')) accountRaw = accountRaw.slice(0, -1) + '-S';
  else if (accountRaw.endsWith('F') || accountRaw.endsWith('f')) accountRaw = accountRaw.slice(0, -1);

  frData.push({
    accountRaw,
    symbol,
    qty,
    fillP,
    time,
    combinedKey: `${accountRaw}${symbol}${fillP}`
  });
}

// Run matching like checkKLGD without filtering July 3
let mismatchedCqgCount = 0;
let july3MismatchedCqgCount = 0;
let nonJuly3MismatchedCqgCount = 0;

frData.forEach(fr => {
  if (fr.symbol === 'ZWAZCE') return;
  const existsInDSGD = dsgdData.some(gd => gd.combinedKey === fr.combinedKey);
  if (!existsInDSGD) {
    mismatchedCqgCount++;
    if (fr.time.startsWith('3/7/26')) {
      july3MismatchedCqgCount++;
    } else {
      nonJuly3MismatchedCqgCount++;
    }
  }
});

let mismatchedMSystemCount = 0;
dsgdData.forEach(gd => {
  if (gd.maTKGD.toUpperCase().endsWith('A')) return;
  const existsInFR = frData.some(fr => fr.combinedKey === gd.combinedKey);
  if (!existsInFR) {
    mismatchedMSystemCount++;
  }
});

console.log(`[07-07-2026 FILES WITH CORRECT PARSING]`);
console.log(`Mismatched CQG trades (not in DSGD): ${mismatchedCqgCount}`);
console.log(`  from July 3: ${july3MismatchedCqgCount}`);
console.log(`  from other dates: ${nonJuly3MismatchedCqgCount}`);
console.log(`Mismatched M-System trades (not in CQG): ${mismatchedMSystemCount}`);
console.log(`Total Bidirectional Mismatched Trades: ${mismatchedCqgCount + mismatchedMSystemCount}`);
