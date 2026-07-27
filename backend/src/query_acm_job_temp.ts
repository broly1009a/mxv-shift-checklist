import { MongoClient } from 'mongodb';
import { decrypt } from './modules/bot-engine/utils/crypto';

const URI =
  'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('mxv_shift_checklist');

  const setting = await db
    .collection('system_settings')
    .findOne({ key: 'bot_credentials_acm' });
  if (setting) {
    console.log('Found bot_credentials_acm:');
    try {
      const decrypted = decrypt(setting.value);
      const parsed = JSON.parse(decrypted);
      console.log('Decrypted settings:');
      console.log(`- URL: ${parsed.url}`);
      console.log(`- Username: ${parsed.username}`);
      console.log(`- Password: [MASKED]`);
      console.log(`- SFTP Host: ${parsed.sftpHost}`);
      console.log(`- SFTP Port: ${parsed.sftpPort}`);
      console.log(`- SFTP Username: ${parsed.sftpUsername}`);
      console.log(`- SFTP Password: [MASKED]`);
      console.log(`- SFTP Remote Dir: ${parsed.sftpRemoteDir}`);
      console.log(
        `- Gemini API Key: ${parsed.geminiApiKey ? 'PRESENT' : 'MISSING'}`,
      );
    } catch (e: any) {
      console.log(`Failed to decrypt or parse: ${e.message}`);
      console.log(`Encrypted value: ${setting.value}`);
    }
  } else {
    console.log('bot_credentials_acm setting not found!');
  }

  await client.close();
}

main().catch(console.error);
