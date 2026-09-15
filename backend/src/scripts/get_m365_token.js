const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  console.log('--- 1. SYSTEM SETTINGS (M365) ---');
  const sys = await db.collection('system_settings').find({ key: { $regex: /m365/i } }).toArray();
  for (const s of sys) {
    console.log(`Key: ${s.key}, valueLength: ${s.value ? s.value.length : 0}, sample: ${s.value ? s.value.slice(0, 15) + '...' : 'empty'}`);
  }

  console.log('\n--- 2. TKGD USER CONFIGS ---');
  const tkgd = await db.collection('tkgd_user_configs').find({}).toArray();
  for (const t of tkgd) {
    console.log(`User: ${t.userEmail}`);
    console.log(`  authorizedEmail: ${t.outlook?.authorizedEmail}`);
    console.log(`  clientId: ${t.outlook?.clientId ? t.outlook.clientId.slice(0, 8) + '...' : 'none'}`);
    console.log(`  hasRefreshToken: ${!!t.outlook?.refreshToken}, length: ${t.outlook?.refreshToken?.length || 0}`);
  }

  await client.close();
}

main().catch(console.error);
