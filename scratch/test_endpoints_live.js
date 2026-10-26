const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
    const jwt = require('jsonwebtoken');
    const mongoose = require('mongoose');
    const dotenv = require('dotenv');
    dotenv.config({ path: '/opt/mxv-checklist/backend/.env' });

    async function run() {
      await mongoose.connect('mongodb://localhost:27017/mxv_shift_checklist');
      const user = await mongoose.connection.db.collection('users').findOne({});
      const secret = process.env.JWT_SECRET || 'secret';
      const payload = { sub: user._id.toString(), username: user.username, role: user.role };
      const token = jwt.sign(payload, secret, { expiresIn: '1h' });
      await mongoose.disconnect();

      console.log('1. Testing Check TTM endpoint...');
      const r1 = await fetch('http://localhost:3001/api/v1/trading-ops/oms-recon/check-ttm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({})
      });
      const j1 = await r1.json();
      console.log('Check TTM Status:', r1.status);
      console.log('Check TTM Summary:', JSON.stringify(j1.data?.summary, null, 2));
      console.log('Check TTM Source Info: ttmFilePath =', j1.data?.ttmFilePath);
      console.log('Check TTM Logs (last 5):');
      (j1.data?.logs || []).slice(-5).forEach(l => console.log('   ' + l));

      console.log('\\n2. Testing Check TTTT endpoint...');
      const r2 = await fetch('http://localhost:3001/api/v1/trading-ops/oms-recon/check-tttt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({})
      });
      const j2 = await r2.json();
      console.log('Check TTTT Status:', r2.status);
      console.log('Check TTTT Summary:', JSON.stringify(j2.data?.summary, null, 2));
      console.log('Check TTTT Source Info: ttttFilePath =', j2.data?.ttttFilePath);
      console.log('Check TTTT Logs (last 5):');
      (j2.data?.logs || []).slice(-5).forEach(l => console.log('   ' + l));
    }

    run().catch(e => console.error(e));
  `;

  conn.exec(`cat << 'EOF' > /tmp/test_call_endpoints.js\n${remoteScript}\nEOF\nNODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/test_call_endpoints.js\nrm -f /tmp/test_call_endpoints.js`, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
});
conn.connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
