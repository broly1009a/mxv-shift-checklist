const mongoose = require('mongoose');

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27018/mxv_shift_checklist');
  const db = mongoose.connection.db;
  const records = await db.collection('clean_account_records')
    .find({ 'ms.hoVaTen': { $exists: true, $ne: null } })
    .project({ maTKGD: 1, 'noiDungMail.tenTaiKhoan': 1, 'ms.hoVaTen': 1, 'ms.soCMND_HoChieu': 1, 'ms.crawledAt': 1 })
    .toArray();
  
  const cccdMap = {};
  for (const r of records) {
    const cccd = r.ms?.soCMND_HoChieu;
    if (!cccd) continue;
    if (!cccdMap[cccd]) cccdMap[cccd] = [];
    cccdMap[cccd].push(r);
  }

  // Lọc chỉ những nhóm có nhiều MÃ TÀI KHOẢN KHÁC NHAU
  const realCrossAccountDupes = [];
  for (const [cccd, list] of Object.entries(cccdMap)) {
    const uniqueAccounts = new Set(list.map(x => x.maTKGD));
    if (uniqueAccounts.size > 1) {
      realCrossAccountDupes.push({ cccd, list });
    }
  }

  console.log('Cross-Account M-System Leak Count:', realCrossAccountDupes.length);
  for (const { cccd, list } of realCrossAccountDupes) {
    console.log(`\nCCCD ${cccd} (MS: ${list[0].ms?.hoVaTen}):`);
    list.forEach(x => {
      console.log(`  - Account: ${x.maTKGD} | MailName: ${x.noiDungMail?.tenTaiKhoan} | CrawledAt: ${x.ms?.crawledAt}`);
    });
  }
  await mongoose.disconnect();
}

main().catch(console.error);
