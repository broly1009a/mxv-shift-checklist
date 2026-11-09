const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const { MongoClient } = require('/opt/mxv-checklist/backend/node_modules/mongodb');

async function main() {
    const client = new MongoClient('mongodb://127.0.0.1:27017/mxv_shift_checklist');
    await client.connect();
    const db = client.db('mxv_shift_checklist');

    console.log("=== COLLECTION: exchange_holidays ===");
    const col = db.collection('exchange_holidays');
    const docs = await col.find({}).sort({ date: 1 }).toArray();
    console.log(\`Tổng số bản ghi: \${docs.length}\`);
    for (const d of docs) {
        console.log(\`  - Sàn: \${d.exchangeCode} | Ngày: \${d.date} | Đóng cửa (isClosed): \${d.isClosed} | Ghi chú: \${d.note}\`);
    }

    console.log("\\n=== COLLECTION: working_calendars (Lịch làm việc Sở MXV) ===");
    const calCol = db.collection('working_calendars');
    const calDocs = await calCol.find({}).sort({ date: 1 }).toArray();
    console.log(\`Tổng số ngày cấu hình đặc biệt: \${calDocs.length}\`);
    for (const c of calDocs) {
        console.log(\`  - Ngày: \${c.date} | Ngày GD (isTradingDay): \${c.isTradingDay} | Nghỉ lễ (isHoliday): \${c.isHoliday} | Cuối tuần (isWeekend): \${c.isWeekend} | Ghi chú: \${c.note}\`);
    }

    await client.close();
}
main().catch(console.error);
`;

  const cmd = `cat << 'EOF' > /tmp/check_holidays.js\n${remoteNode}\nEOF\nnode /tmp/check_holidays.js\nrm -f /tmp/check_holidays.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });
