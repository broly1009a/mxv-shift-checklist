const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27018/mxv_shift_checklist');
  const db = mongoose.connection.db;
  const col = db.collection('clean_account_records');
  const record = await col.findOne({ maTKGD: '001C0126162' });
  console.log('Record found:');
  console.log('maTKGD:', record?.maTKGD);
  console.log('batchDate:', record?.batchDate);
  console.log('files:', JSON.stringify(record?.files, null, 2));
  console.log('noiDungMail files / attachments:', JSON.stringify(record?.noiDungMail?.files || record?.noiDungMail?.attachments, null, 2));
  console.log('hopDong:', JSON.stringify(record?.hopDong, null, 2));
  console.log('canCuoc:', JSON.stringify(record?.canCuoc, null, 2));
  console.log('ms:', JSON.stringify(record?.ms, null, 2));

  // Check files on disk
  console.log('\nChecking local temp directory:');
  const tempDir = path.join(process.cwd(), 'data', 'temp_tkgd_attachments');
  if (fs.existsSync(tempDir)) {
    console.log('tempDir exists, searching for 001C0126162...');
    function searchRecursive(dir) {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const full = path.join(dir, item);
        if (item.includes('001C0126162') || item.includes('DangVinhPhuc')) {
          console.log('Found:', full);
          if (fs.statSync(full).isDirectory()) {
            console.log('Directory contents:', fs.readdirSync(full));
          }
        } else if (fs.statSync(full).isDirectory()) {
          searchRecursive(full);
        }
      }
    }
    searchRecursive(tempDir);
  }

  await mongoose.disconnect();
}
run().catch(console.error);
