const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const job = await mongoose.connection.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ad9d5b7a066642fccdc13e8') });
  
  console.log('pendingSyncTrades:', JSON.stringify(job.payload?.result?.pendingSyncTrades || [], null, 2));
  console.log('mismatchedTrades:', JSON.stringify(job.payload?.result?.mismatchedTrades || [], null, 2));

  await mongoose.disconnect();
}
run().catch(console.error);
`;

  conn.exec(`cat << 'EOF' > /tmp/check_pending_trades.js\n${remoteScript}\nEOF\nnode /tmp/check_pending_trades.js`, (err, stream) => {
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
