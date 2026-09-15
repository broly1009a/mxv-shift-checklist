const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';
const codes = [
  '003C2311200', '085C0947827', '003C0879444', '003C0534241',
  '003C1564927', '003C0807375', '003C1731326', '003C1684879',
  '003C6550243', '003C1684184', '003C1669379', '003C0094629',
  '003C9052476', '003C1719053'
];

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const col = db.collection('clean_account_records');
  const records = await col.find({ maTKGD: { $in: codes } }).toArray();
  console.log(`FOUND_${records.length}_OF_${codes.length}`);
  
  for (const r of records) {
    console.log('=== ' + r.maTKGD + ' ===');
    console.log('hoVaTen:', r.canCuoc?.hoVaTen || r.ms?.hoVaTen);
    console.log('soCCCD_OCR:', r.canCuoc?.soCCCD);
    console.log('ngaySinh_OCR:', r.canCuoc?.ngaySinh);
    console.log('gioiTinh_OCR:', r.canCuoc?.gioiTinh);
    console.log('ngayCap_OCR:', r.canCuoc?.ngayCap);
    console.log('queQuan_OCR:', r.canCuoc?.queQuan);
    console.log('noiThuongTru_OCR:', r.canCuoc?.noiThuongTru);
    console.log('anhMatTruocLocalPath:', r.canCuoc?.anhMatTruocLocalPath);
    console.log('anhMatSauLocalPath:', r.canCuoc?.anhMatSauLocalPath);
    console.log('anhMatTruocUrl:', r.canCuoc?.anhMatTruocUrl);
    console.log('anhMatSauUrl:', r.canCuoc?.anhMatSauUrl);
    console.log('ms_soCMND:', r.ms?.soCMND_HoChieu);
    console.log('ms_hoVaTen:', r.ms?.hoVaTen);
    console.log('ms_ngaySinh:', r.ms?.ngaySinh);
    console.log('mail_attachments:', JSON.stringify(r.noiDungMail?.attachments || []));
    console.log('recon_errors:', JSON.stringify(r.reconciliationResult?.criticalErrors || []));
  }
  await client.close();
}
run().catch(console.error);
