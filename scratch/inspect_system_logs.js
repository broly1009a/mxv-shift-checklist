const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '../backend/.env');
const envText = fs.readFileSync(envPath, 'utf8');
let uri = '';
for (let line of envText.split('\n')) {
  line = line.trim();
  if (line.startsWith('MONGODB_URI=') || line.startsWith('MONGO_URI=')) {
    uri = line.substring(line.indexOf('=') + 1).trim();
    if (uri.startsWith('"') && uri.endsWith('"')) uri = uri.slice(1, -1);
    if (uri.startsWith("'") && uri.endsWith("'")) uri = uri.slice(1, -1);
    break;
  }
}

const mongoose = require(path.resolve(__dirname, '../backend/node_modules/mongoose'));

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const sysLogsCount = await db.collection('system_logs').countDocuments();
  const auditLogsCount = await db.collection('audit_logs').countDocuments();
  console.log('Total system_logs:', sysLogsCount);
  console.log('Total audit_logs:', auditLogsCount);
  
  const distinctEventTypes = await db.collection('system_logs').distinct('eventType');
  console.log('SystemLog eventTypes in DB:', distinctEventTypes);

  const logs = await db.collection('system_logs').find().sort({ createdAt: -1 }).limit(10).toArray();
  for (const l of logs) {
    console.log(`[${l.createdAt?.toISOString()}] ${l.eventType}: ${l.message}`);
  }
  await mongoose.disconnect();
}

main().catch(console.error);
