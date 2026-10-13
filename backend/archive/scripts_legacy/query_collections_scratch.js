const { MongoClient } = require('mongodb');

async function run() {
  const client = new MongoClient('mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority');
  try {
    await client.connect();
    const db = client.db();
    
    // 1. Get all collection names
    const collections = await db.listCollections().toArray();
    console.log('--- COLLECTIONS ---');
    console.log(collections.map(c => c.name));

    // 2. Query users with role ADMIN
    console.log('\n--- ADMIN USERS ---');
    const admins = await db.collection('users').find({ role: 'ADMIN' }).toArray();
    console.log(admins.map(u => ({ id: u._id, username: u.username, email: u.email, fullName: u.fullName })));

    // 3. Let's inspect the notification_logs collection count and look at a few records
    console.log('\n--- NOTIFICATION LOGS COUNT ---');
    const count = await db.collection('notification_logs').countDocuments();
    console.log('Total notification logs:', count);
    if (count > 0) {
      console.log('Sample notification log:');
      const samples = await db.collection('notification_logs').find({}).limit(2).toArray();
      console.log(JSON.stringify(samples, null, 2));
    }

    // 4. Let's inspect notification_rules
    console.log('\n--- NOTIFICATION RULES ---');
    const rules = await db.collection('notification_rules').find({}).toArray();
    console.log(rules.map(r => ({ id: r._id, code: r.code, name: r.name, recipient: r.recipient })));

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
