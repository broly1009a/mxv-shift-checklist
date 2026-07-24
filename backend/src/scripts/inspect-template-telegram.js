const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const templates = await db.collection('shift_templates').find({}).toArray();
  console.log(`Found ${templates.length} templates in shift_templates.`);

  templates.forEach(t => {
    console.log(`Template ID: ${t._id}, Title: ${t.title}`);
    if (t.tasks && Array.isArray(t.tasks)) {
      t.tasks.forEach(task => {
        if (
          (task.taskName && task.taskName.toLowerCase().includes('telegram')) ||
          (task.actionDescription && task.actionDescription.toLowerCase().includes('telegram'))
        ) {
          console.log(` -> Task ID: ${task.taskId}, Name: "${task.taskName}"`);
        }
      });
    }
  });

  await client.close();
}

main().catch(console.error);
