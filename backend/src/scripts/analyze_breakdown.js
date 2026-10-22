const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');

function parseLogTimestamp(str) {
  const match = str.match(/\\[([0-9T:\\.-]+Z)\\]/);
  return match ? new Date(match[1]).getTime() : null;
}

function analyzeJob(job, name) {
  console.log('=== ' + name + ' (' + job._id + ') ===');
  const logs = job.logs || [];
  let tStart = null;
  let tLoginCqg2 = null;
  let tLoginCqg1 = null;
  let tBarrierOpen = null;
  let tAcmDone = null;
  let tMsDone = null;
  let tCcpDone = null;
  let tCqgDone = null;
  let tMergeDone = null;
  let tReconDone = null;

  for (const l of logs) {
    const t = parseLogTimestamp(l);
    if (!t) continue;
    if (!tStart && l.includes('Starting attempt')) tStart = t;
    if (l.includes('CQG2') && l.includes('Đã vào màn hình FR2')) tLoginCqg2 = t;
    if (l.includes('CQG1') && l.includes('Đã vào màn hình FR1')) tLoginCqg1 = t;
    if (l.includes('Rào cản đã mở!')) tBarrierOpen = t;
    if (l.includes('ACM') && l.includes('hoàn tất')) tAcmDone = t;
    if (l.includes('MS') && l.includes('Đã sẵn sàng dữ liệu đầy đủ')) tMsDone = t;
    if (l.includes('CCP') && l.includes('hoàn tất:')) tCcpDone = t;
    if (l.includes('CQG') && l.includes('Đã tải: FR2.xlsx')) tCqgDone = t;
    if (l.includes('CQG') && l.includes('Ghép file CQG hoàn tất')) tMergeDone = t;
    if (l.includes('Kết quả: KHỚP')) tReconDone = t;
  }

  console.log('1. Khoi dong -> CQG Login ready:  ' + ((tLoginCqg1 && tStart ? (tLoginCqg1 - tStart)/1000 : 'N/A')) + ' s');
  console.log('2. Cho Rao can mo (Barrier wait): ' + ((tBarrierOpen && tLoginCqg1 ? (tBarrierOpen - tLoginCqg1)/1000 : 'N/A')) + ' s');
  console.log('3. Tai MS (REST API):             ' + ((tMsDone && tBarrierOpen ? (tMsDone - tBarrierOpen)/1000 : 'N/A')) + ' s');
  console.log('4. Tai CCP (REST API):            ' + ((tCcpDone && tBarrierOpen ? (tCcpDone - tBarrierOpen)/1000 : 'N/A')) + ' s');
  console.log('5. Tai CQG (FR, PS, OP):          ' + ((tCqgDone && tBarrierOpen ? (tCqgDone - tBarrierOpen)/1000 : 'N/A')) + ' s');
  console.log('6. Ghep file (Merge):             ' + ((tMergeDone && tCqgDone ? (tMergeDone - tCqgDone)/1000 : 'N/A')) + ' s');
  console.log('7. Chay doi chieu (Recon):        ' + ((tReconDone && tMergeDone ? (tReconDone - tMergeDone)/1000 : 'N/A')) + ' s');
  console.log('TOTAL RUNTIME:                    ' + ((tReconDone && tStart ? (tReconDone - tStart)/1000 : 'N/A')) + ' s');
  console.log('');
}

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const jobFast = await mongoose.connection.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ad91cfd8c3a20a9674cf4c1') });
  const jobAvg = await mongoose.connection.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ad8cdde8c3a20a9674cf4a5') });
  const jobToday1 = await mongoose.connection.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ad9d128a066642fccdc13da') });
  const jobToday2 = await mongoose.connection.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ad9d257a066642fccdc13df') });

  analyzeJob(jobFast, 'YESTERDAY FASTEST');
  analyzeJob(jobAvg, 'YESTERDAY AVERAGE');
  analyzeJob(jobToday1, 'TODAY RUN 1');
  analyzeJob(jobToday2, 'TODAY RUN 2');

  await mongoose.disconnect();
}
run().catch(console.error);
`;

  conn.exec(`cat << 'EOF' > /tmp/analyze_breakdown.js\n${remoteScript}\nEOF\nnode /tmp/analyze_breakdown.js`, (err, stream) => {
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
