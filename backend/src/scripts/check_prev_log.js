const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const jobPrev = await mongoose.connection.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ad9d381a066642fccdc13e5') });

  console.log('=== LOGS OF PREV JOB (16:12) ===');
  for (const l of jobPrev.logs || []) {
    if (l.includes('Bảo lưu') || l.includes('Kết quả') || l.includes('Chi tiết') || l.includes('LỆCH') || l.includes('KHỚP')) {
      console.log(l);
    }
  }

  await mongoose.disconnect();
}
run().catch(console.error);
`;

  conn.exec(`cat << 'EOF' > /tmp/check_prev_log.js\n${remoteScript}\nEOF\nnode /tmp/check_prev_log.js`, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).on('error', err => console.error(err)).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
