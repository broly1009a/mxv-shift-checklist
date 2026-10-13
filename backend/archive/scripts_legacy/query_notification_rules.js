const { MongoClient } = require('mongodb');

async function run() {
  const client = new MongoClient('mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority');
  try {
    await client.connect();
    const db = client.db();
    
    // Query notification rules
    console.log('--- ALL NOTIFICATION RULES DETAIL ---');
    const rules = await db.collection('notification_rules').find({}).toArray();
    console.log(JSON.stringify(rules, null, 2));

    // Let's also check if there is an old collection or any other collections that might contain notifications
    console.log('\n--- DOCUMENT COUNT IN OTHER RELATED COLLECTIONS ---');
    const systemSettingsCount = await db.collection('system_settings').countDocuments();
    const auditLogsCount = await db.collection('audit_logs').countDocuments();
    const systemLogsCount = await db.collection('system_logs').countDocuments();
    console.log({ systemSettingsCount, auditLogsCount, systemLogsCount });

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
