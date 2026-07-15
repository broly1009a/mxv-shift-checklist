const { MongoClient } = require('mongodb');

const URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  console.log('✅ Connected to MongoDB');

  const db = client.db('mxv_shift_checklist');

  // 1. Print all system_settings
  const settings = await db.collection('system_settings').find({}).toArray();
  console.log('\n--- SYSTEM SETTINGS ---');
  for (const s of settings) {
    console.log(`Key: "${s.key}", Value length: ${s.value ? s.value.length : 0}`);
    if (s.key === 'member_teams_webhooks' || s.key.includes('webhook') || s.key.includes('teams')) {
      console.log(`Value:`, s.value);
    }
  }

  // 2. Print all notification_channels
  const channels = await db.collection('notification_channels').find({}).toArray();
  console.log('\n--- NOTIFICATION CHANNELS ---');
  for (const c of channels) {
    console.log(`Channel: Name: "${c.name}", Code: "${c.code}", Type: "${c.type}", IsActive: ${c.isActive}`);
  }

  await client.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
