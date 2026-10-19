const fs = require('fs');
const pathMod = require('path');
const XLSX = require(pathMod.join(__dirname, '../backend/node_modules/xlsx'));

const dir = 'M:/Tailieuchung/QLGD-IT/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026/19.10';

function readSheet(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const wb = XLSX.readFile(filePath);
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
}

const r1 = readSheet(dir + '/FR1.xlsx');
const r2 = readSheet(dir + '/FR2.xlsx');
const r = readSheet(dir + '/FR.xlsx');

console.log('FR1 total rows:', r1.length);
console.log('FR2 total rows:', r2.length);
console.log('FR total rows:', r.length);

const d1 = r1.length > 4 ? r1.slice(2, r1.length - 2) : [];
const d2 = r2.length > 4 ? r2.slice(2, r2.length - 2) : [];
const d = r.length > 4 ? r.slice(2, r.length - 2) : [];

console.log('FR1 data rows:', d1.length);
console.log('FR2 data rows:', d2.length);
console.log('FR data rows:', d.length);
console.log('Sum d1 + d2:', d1.length + d2.length);

// Check if any row in d2 is identical to any row in d1
const headers = (r1[1] || []).map(h => String(h || '').trim());
const ordIdx = headers.indexOf('Ord #');
const accIdx = headers.indexOf('Account');
const symIdx = headers.indexOf('Symbol');
const qtyIdx = headers.indexOf('Qty');
const fillPIdx = headers.indexOf('Fill P');
const timeIdx = headers.indexOf('Time');

console.log('Indices:', { ordIdx, accIdx, symIdx, qtyIdx, fillPIdx, timeIdx });

let exactOverlap = 0;
let ordOnlyOverlap = 0;
const d1Keys = new Set(d1.map(row => `${row[ordIdx]}|${row[accIdx]}|${row[symIdx]}|${row[qtyIdx]}|${row[fillPIdx]}|${row[timeIdx]}`));
const d1Ords = new Set(d1.map(row => String(row[ordIdx]).trim()));

for (const row of d2) {
  const key = `${row[ordIdx]}|${row[accIdx]}|${row[symIdx]}|${row[qtyIdx]}|${row[fillPIdx]}|${row[timeIdx]}`;
  const ord = String(row[ordIdx]).trim();
  if (d1Keys.has(key)) exactOverlap++;
  if (d1Ords.has(ord)) ordOnlyOverlap++;
}

console.log('Exact duplicate rows between FR1 and FR2:', exactOverlap);
console.log('Rows in FR2 sharing Ord # with FR1:', ordOnlyOverlap);

const seenInD1 = new Set();
const internalD1Dups = [];
for (const row of d1) {
  const ord = String(row[ordIdx]).trim();
  if (seenInD1.has(ord)) {
    internalD1Dups.push(row);
  }
  seenInD1.add(ord);
}
console.log('Internal duplicates in d1 by Ord #:', internalD1Dups.length);
let d1LostLots = 0;
internalD1Dups.forEach(r => { d1LostLots += Number(r[qtyIdx] || 0); });
console.log('Total lots dropped in d1 if deduped by Ord #:', d1LostLots);

const seenInD2 = new Set();
const internalD2Dups = [];
for (const row of d2) {
  const ord = String(row[ordIdx]).trim();
  if (seenInD2.has(ord)) {
    internalD2Dups.push(row);
  }
  seenInD2.add(ord);
}
console.log('Internal duplicates in d2 by Ord #:', internalD2Dups.length);

let d2LostLots = 0;
internalD2Dups.forEach(r => { d2LostLots += Number(r[qtyIdx] || 0); });
console.log('Total lots dropped in d2 if deduped by Ord #:', d2LostLots);
console.log('TOTAL LOST LOTS IN FR (d1 + d2):', d1LostLots + d2LostLots);


