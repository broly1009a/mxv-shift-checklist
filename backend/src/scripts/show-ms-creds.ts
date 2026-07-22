import * as dotenv from 'dotenv';
dotenv.config();

import { MongoClient } from 'mongodb';
import { decrypt } from '../modules/bot-engine/utils/crypto';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI || '');
  await client.connect();
  const db = client.db('mxv_shift_checklist');
  const settings = await db.collection('system_settings').find({}).toArray();
  console.log('Available keys in system_settings:', settings.map(s => s.key));

  const setting = settings.find(s => s.key === 'bot_credentials_msystem');
  if (setting) {
    const creds = JSON.parse(decrypt(setting.value));
    console.log('Decrypted M-System Username:', creds.username);
    console.log('Decrypted M-System URL:', creds.url);
  }
  await client.close();
}

main().catch(console.error);
