const fs = require('fs');
const seed = JSON.parse(fs.readFileSync('backend/assets/reports/monthly_report_09_2026_seed.json', 'utf8'));

console.log('CQG Commodities count:', seed.section2Commodities.cqg.items.length);
console.log('CQG sample:', seed.section2Commodities.cqg.items.slice(0, 10).map(x => x.commodityName));
console.log('ACM Commodities:', seed.section2Commodities.acm.items.map(x => x.commodityName));

