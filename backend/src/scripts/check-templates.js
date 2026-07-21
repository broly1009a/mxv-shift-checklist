const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function check() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');
  const tmpls = await db.collection('checklist_templates').find({}).toArray();
  console.log(`Found ${tmpls.length} templates:`);
  for (const t of tmpls) {
    console.log(`\nTemplate: ${t.title} (_id: ${t._id})`);
    const tasks = t.tasks || [];
    const parents = tasks.filter(x => !x.parentTaskId);
    const children = tasks.filter(x => !!x.parentTaskId);
    console.log(`  Total tasks: ${tasks.length} (Parents: ${parents.length}, Children: ${children.length})`);
    for (const child of children) {
      console.log(`    - Child [${child.taskId}] "${child.taskName}" -> Parent: ${child.parentTaskId}`);
    }
  }
  await client.close();
}

check().catch(console.error);
