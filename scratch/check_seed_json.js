const fs = require('fs');

const p = '6thang11nam2026.TinhNangMoi/monthly_report_09_2026_extracted.json';
if (fs.existsSync(p)) {
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  console.log('Keys:', Object.keys(data));
  console.log('section3Specials keys:', Object.keys(data.section3Specials || {}));
  console.log('Spread count:', data.section3Specials?.spread?.items?.length);
  console.log('LME count:', data.section3Specials?.lme?.items?.length);
  console.log('Options count:', data.section3Specials?.options?.items?.length);
  if (data.section3Specials?.spread?.items?.length) {
    console.log('First 3 Spread items:');
    console.log(data.section3Specials.spread.items.slice(0, 3));
  }
} else {
  console.log('File does not exist:', p);
}

