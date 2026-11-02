/**
 * SCRIPT MIGRATION: CHUẨN HÓA DỮ LIỆU DANH SÁCH TK ÂM KÝ QUỸ (MS & CCP)
 * File: backend/src/scripts/migrate_negative_accounts_schema.js
 * 
 * Mục tiêu:
 * - Quét các key 'negative_margin_monitored_accounts' và 'negative_margin_monitored_accounts_ccp' trong MongoDB.
 * - Chuyển đổi dứt điểm các dữ liệu cũ dạng string ["088C000001", ...] sang Object chuẩn MonitoredNegativeAccount.
 * - Tuân thủ nguyên tắc Zero Fabricated Data:
 *   + Các trường số dư, ký quỹ, ngày phiên được gán là null (N/A) nếu chưa có số liệu phiên.
 *   + Tuyệt đối không tự ý gán bằng 0 hoặc new Date().
 * 
 * Hướng dẫn chạy:
 *   node backend/src/scripts/migrate_negative_accounts_schema.js
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://10.0.0.26:27017/checklist';

function migrateArray(rawArray, system) {
  if (!Array.isArray(rawArray)) return [];
  const migrated = [];
  let convertedCount = 0;

  for (const item of rawArray) {
    if (!item) continue;
    if (typeof item === 'string') {
      const clean = item.trim().toUpperCase();
      if (!clean) continue;
      migrated.push({
        account: clean,
        negativeType: 'MANUAL',
        currentBalance: null,
        availableMargin: null,
        additionalMargin: null,
        initialRequiredMargin: null,
        recordedSessionDate: null,
        system: system,
        updatedAt: new Date().toISOString(),
        note: 'Dữ liệu di chuyển (Chờ phiên EOD quét đối soát)',
      });
      convertedCount++;
    } else if (typeof item === 'object' && item.account) {
      migrated.push({
        account: String(item.account).trim().toUpperCase(),
        negativeType: item.negativeType || 'MANUAL',
        currentBalance: item.currentBalance !== undefined && item.currentBalance !== null ? Number(item.currentBalance) : null,
        availableMargin: item.availableMargin !== undefined && item.availableMargin !== null ? Number(item.availableMargin) : null,
        additionalMargin: item.additionalMargin !== undefined && item.additionalMargin !== null ? Number(item.additionalMargin) : null,
        initialRequiredMargin: item.initialRequiredMargin !== undefined && item.initialRequiredMargin !== null ? Number(item.initialRequiredMargin) : null,
        recordedSessionDate: item.recordedSessionDate || null,
        system: item.system || system,
        updatedAt: item.updatedAt || new Date().toISOString(),
        note: item.note,
      });
    }
  }

  return { migrated, convertedCount };
}

async function runMigration() {
  console.log('Connecting to MongoDB:', MONGO_URI);
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection('system_settings');

    const keys = [
      { key: 'negative_margin_monitored_accounts', system: 'MS' },
      { key: 'negative_margin_monitored_accounts_ccp', system: 'CCP' },
    ];

    for (const { key, system } of keys) {
      const doc = await collection.findOne({ key });
      if (!doc || !doc.value) {
        console.log(`[INFO] Setting ${key} not found or empty.`);
        continue;
      }

      let parsed;
      try {
        parsed = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;
      } catch (err) {
        console.error(`[ERROR] Failed to parse value for ${key}:`, err);
        continue;
      }

      const { migrated, convertedCount } = migrateArray(parsed, system);
      console.log(`[INFO] Key: ${key} | Total accounts: ${migrated.length} | Converted from string: ${convertedCount}`);

      if (convertedCount > 0) {
        await collection.updateOne(
          { key },
          { $set: { value: JSON.stringify(migrated), updatedAt: new Date() } }
        );
        console.log(`[SUCCESS] Migrated ${key} to strict object schema!`);
      } else {
        console.log(`[OK] ${key} is already in strict object schema.`);
      }
    }

    console.log('\nMigration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { migrateArray };

