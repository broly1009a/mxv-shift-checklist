const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const folder = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures\\2026\\T09.2026\\16.09';
const dsgdPath = path.join(folder, 'DSGD_16.09.2026.xlsx');
const ttmPath = path.join(folder, 'TTM_16.09.2026.xlsx');
const ttttPath = path.join(folder, 'TTTT_16.09.2026.xlsx');

console.log('=== INSPECTING CCP 16.09.2026 ===');

if (fs.existsSync(dsgdPath)) {
  const wb = XLSX.readFile(dsgdPath);
  console.log('DSGD Sheets:', wb.SheetNames);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log('DSGD Total rows:', rows.length);
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    console.log('DSGD Row ' + i + ':', JSON.stringify(rows[i]));
  }
} else {
  console.log('DSGD not found');
}

if (fs.existsSync(ttmPath)) {
  const wb = XLSX.readFile(ttmPath);
  console.log('\nTTM Sheets:', wb.SheetNames);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log('TTM Total rows:', rows.length);
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    console.log('TTM Row ' + i + ':', JSON.stringify(rows[i]));
  }
}

if (fs.existsSync(ttttPath)) {
  const wb = XLSX.readFile(ttttPath);
  console.log('\nTTTT Sheets:', wb.SheetNames);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log('TTTT Total rows:', rows.length);
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    console.log('TTTT Row ' + i + ':', JSON.stringify(rows[i]));
  }
}
