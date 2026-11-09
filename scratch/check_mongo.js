const mongoose = require('mongoose');

const uri = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  
  // 1. monthly_report_snapshots
  const snapshots = await db.collection('monthly_report_snapshots').find({}, { projection: { monthYear: 1, 'section3Specials.spread.items.length': 1, 'section3Specials.lme.items.length': 1, 'section3Specials.options.items.length': 1 } }).toArray();
  console.log('\n--- Monthly Snapshots ---');
  console.log(JSON.stringify(snapshots, null, 2));

  // 2. special_account_monthly_tracking
  const specialDocs = await db.collection('special_account_monthly_tracking').find({}).toArray();
  console.log(`\n--- Special Account Monthly Tracking (${specialDocs.length} docs) ---`);
  for (const d of specialDocs) {
    console.log(`${d.monthYear} | ${d.category} | ${d.tvkdCode} | ${d.tvkdFullName} | activeBefore: ${d.activeBeforeMonth} | newActive: ${d.newActiveInMonth} | total: ${d.totalActiveCumulative}`);
  }

  // 3. Inspect Month 9 snapshot details if exists
  const snap09 = await db.collection('monthly_report_snapshots').findOne({ monthYear: '2026-09' });
  if (snap09) {
    console.log('\n--- Month 9 snapshot Section III summary ---');
    console.log('Spread items:', snap09.section3Specials?.spread?.items?.length);
    console.log('LME items:', snap09.section3Specials?.lme?.items?.length);
    console.log('Options items:', snap09.section3Specials?.options?.items?.length);
    if (snap09.section3Specials?.spread?.items?.length) {
      console.log('Sample Spread item:', snap09.section3Specials.spread.items[0]);
    }
  }

  // 4. Inspect Month 10 snapshot details if exists
  const snap10 = await db.collection('monthly_report_snapshots').findOne({ monthYear: '2026-10' });
  if (snap10) {
    console.log('\n--- Month 10 snapshot Section III summary ---');
    console.log('Spread items:', snap10.section3Specials?.spread?.items?.length);
    console.log('LME items:', snap10.section3Specials?.lme?.items?.length);
    console.log('Options items:', snap10.section3Specials?.options?.items?.length);
    if (snap10.section3Specials?.spread?.items?.length) {
      console.log('Sample Spread item:', snap10.section3Specials.spread.items[0]);
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);

