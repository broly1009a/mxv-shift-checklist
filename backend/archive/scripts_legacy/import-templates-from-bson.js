/**
 * import-templates-from-bson.js
 * Đọc file backup BSON và import lại vào MongoDB collection checklist_templates
 * Chạy: node import-templates-from-bson.js
 */
const { MongoClient, BSON } = require('mongodb');
const fs = require('fs');
const path = require('path');

// --- CẤU HÌNH ---
const MONGO_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';
const DB_NAME = 'mxv_shift_checklist';
const COLLECTION_NAME = 'checklist_templates';
const BSON_FILE_PATH = 'C:\\Users\\hiepth\\Desktop\\db-backup-all\\mxv_shift_checklist\\checklist_templates.bson';

async function run() {
  console.log('=== Import Checklist Templates from BSON Backup ===');
  console.log(`Reading BSON file: ${BSON_FILE_PATH}`);
  
  if (!fs.existsSync(BSON_FILE_PATH)) {
    console.error('ERROR: BSON file not found at path:', BSON_FILE_PATH);
    process.exit(1);
  }

  const bsonBuffer = fs.readFileSync(BSON_FILE_PATH);
  console.log(`File size: ${bsonBuffer.length} bytes`);

  // Parse all BSON documents from the file
  const documents = [];
  let offset = 0;
  while (offset < bsonBuffer.length) {
    // Each BSON document starts with a 4-byte little-endian int32 indicating doc size
    const docSize = bsonBuffer.readInt32LE(offset);
    if (docSize <= 0 || offset + docSize > bsonBuffer.length) break;
    const docBuffer = bsonBuffer.slice(offset, offset + docSize);
    const doc = BSON.deserialize(docBuffer);
    documents.push(doc);
    offset += docSize;
  }

  console.log(`Parsed ${documents.length} documents from BSON file.`);
  if (documents.length === 0) {
    console.error('ERROR: No documents parsed from BSON file.');
    process.exit(1);
  }

  console.log('\nSample document titles:');
  documents.slice(0, 5).forEach(d => console.log(`  - ${d.title} (${d.sessionType})`));

  // Connect to MongoDB
  console.log('\nConnecting to MongoDB...');
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log('Connected!');

  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);

  // Drop existing collection
  console.log(`\nDropping existing collection "${COLLECTION_NAME}"...`);
  await collection.drop().catch(() => console.log('Collection did not exist, skipping drop.'));

  // Insert all documents
  console.log(`Inserting ${documents.length} documents...`);
  const result = await collection.insertMany(documents);
  console.log(`Successfully inserted: ${result.insertedCount} documents.`);

  // Verify
  const count = await collection.countDocuments();
  console.log(`\nVerification - Total documents in "${COLLECTION_NAME}": ${count}`);

  const titles = await collection.find({}, { projection: { title: 1, sessionType: 1, isActive: 1 } }).toArray();
  console.log('\nAll templates restored:');
  titles.forEach(t => console.log(`  - [${t.sessionType}] ${t.title} | isActive: ${t.isActive}`));

  await client.close();
  console.log('\n=== Import completed successfully! ===');
  console.log('Please restart the backend server to reload templates.');
}

run().catch(err => {
  console.error('FATAL ERROR:', err.message);
  process.exit(1);
});
