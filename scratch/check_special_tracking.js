const mongoose = require("mongoose");

async function main() {
  await mongoose.connect("mongodb://127.0.0.1:27017/mxv_shift_checklist");
  const collection = mongoose.connection.collection("special_account_monthly_tracking");
  const docs = await collection.find({}).toArray();
  console.log(`Found ${docs.length} docs in special_account_monthly_tracking:`);
  for (const d of docs) {
    console.log(`${d.monthYear} | ${d.category} | ${d.tvkdCode} | prev=${d.activeBeforeMonth} | new=${d.newActiveInMonth} | total=${d.totalActive}`);
  }
  
  const snaps = await mongoose.connection.collection("monthly_report_snapshots").find({}).toArray();
  console.log(`\nFound ${snaps.length} snapshots in monthly_report_snapshots:`);
  for (const s of snaps) {
    console.log(`Snapshot: ${s.monthYear} (status: ${s.status}, version: ${s.version})`);
    if (s.section3Specials) {
      console.log(`  Spread items: ${s.section3Specials.spread?.items?.length}`);
      console.log(`  Lme items: ${s.section3Specials.lme?.items?.length}`);
      console.log(`  Options items: ${s.section3Specials.options?.items?.length}`);
    }
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

