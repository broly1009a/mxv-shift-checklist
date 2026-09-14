import { Client } from 'ssh2';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { decrypt } from '../modules/bot-engine/utils/crypto';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function syncCreds() {
  console.log('⏳ Đang kết nối Ubuntu Server 10.0.0.26 để trích xuất bot_credentials_cqg...');
  const conn = new Client();

  conn.on('ready', () => {
    conn.exec('mongosh mxv_shift_checklist --quiet --eval "JSON.stringify(db.system_settings.findOne({key: \'bot_credentials_cqg\'}))"', (err, stream) => {
      if (err) {
        console.error('Lỗi SSH exec:', err.message);
        conn.end();
        return;
      }
      let out = '';
      stream.on('data', (d: any) => { out += d.toString(); });
      stream.on('close', async () => {
        conn.end();
        try {
          const doc = JSON.parse(out.trim());
          if (doc && doc.value) {
            const creds = JSON.parse(decrypt(doc.value));
            console.log('✅ Đã trích xuất thành công tài khoản CQG từ Ubuntu:');
            console.log(`   - CQG1: ${creds.username1 || creds.usernameCQG1}`);
            console.log(`   - CQG2: ${creds.username2 || creds.usernameCQG2}`);
            console.log(`   - URL: ${creds.url || creds.urlTrade}`);

            const mongoUri = process.env.MONGODB_URI;
            if (mongoUri) {
              await mongoose.connect(mongoUri);
              await mongoose.connection.db!.collection('system_settings').updateOne(
                { key: 'bot_credentials_cqg' },
                { $set: { value: doc.value, updatedAt: new Date() } },
                { upsert: true }
              );
              console.log('✅ Đã đồng bộ tài khoản CQG từ Ubuntu vào Database Atlas thành công!');
              await mongoose.disconnect();
            }
          } else {
            console.error('Không tìm thấy bản ghi trên Ubuntu:', out);
          }
        } catch (e: any) {
          console.error('Lỗi phân tích:', e.message);
        }
      });
    });
  });

  conn.connect({
    host: '10.0.0.26',
    port: 22,
    username: 'mxvadmin',
    password: 'MxV!,#2o26',
  });
}

syncCreds();
