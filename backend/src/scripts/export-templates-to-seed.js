const { MongoClient } = require('mongodb');
const fs = require('fs');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function exportSeed() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');
  const tmpls = await db.collection('checklist_templates').find({}).toArray();

  const formatted = tmpls.map(t => ({
    title: t.title,
    departmentCode: t.title.includes('IT Vận Hành') ? 'IT_CORE' : t.title.includes('Trading Operations') ? 'QLGD_OPS' : 'QLRR_RISK',
    sessionType: t.sessionType,
    shiftSlotCode: t.sessionType === 'OPEN' ? 'SHIFT_3' : t.sessionType === 'DURING' ? 'SHIFT_1' : 'SHIFT_2',
    tasks: (t.tasks || []).map(k => {
      const copy = { ...k };
      delete copy._id;
      return copy;
    })
  }));

  console.log(`Exported ${formatted.length} templates. Total tasks across templates: ${formatted.reduce((acc, curr) => acc + curr.tasks.length, 0)}`);
  fs.writeFileSync('src/database/exported_templates.json', JSON.stringify(formatted, null, 2));
  await client.close();
}

exportSeed().catch(console.error);
