const fs = require('fs');

const p = 'backend/assets/reports/monthly_report_09_2026_seed.json';
const data = JSON.parse(fs.readFileSync(p, 'utf8'));
console.log('section3Specials spread count:', data.section3Specials?.spread?.items?.length);
console.log('section3Specials lme count:', data.section3Specials?.lme?.items?.length);
console.log('section3Specials options count:', data.section3Specials?.options?.items?.length);

