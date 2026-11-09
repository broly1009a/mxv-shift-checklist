const fs = require('fs');

const p = 'backend/assets/reports/monthly_report_09_2026_seed.json';
const data = JSON.parse(fs.readFileSync(p, 'utf8'));

console.log('--- SPREAD ITEMS ---');
console.log(JSON.stringify(data.section3Specials?.spread?.items?.slice(0, 5), null, 2));

console.log('--- LME ITEMS ---');
console.log(JSON.stringify(data.section3Specials?.lme?.items?.slice(0, 5), null, 2));

console.log('--- OPTIONS ITEMS ---');
console.log(JSON.stringify(data.section3Specials?.options?.items?.slice(0, 5), null, 2));

