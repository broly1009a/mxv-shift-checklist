const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
    const jwt = require('jsonwebtoken');
    const mongoose = require('mongoose');
    const dotenv = require('dotenv');
    dotenv.config({ path: '/opt/mxv-checklist/backend/.env' });

    async function test() {
      await mongoose.connect('mongodb://localhost:27017/mxv_shift_checklist');
      const user = await mongoose.connection.db.collection('users').findOne({});
      const secret = process.env.JWT_SECRET || 'secret';
      const token = jwt.sign({ sub: user._id.toString(), username: user.username, role: user.role }, secret, { expiresIn: '1h' });
      await mongoose.disconnect();

      console.log('1. Testing GET /api/v1/ce-clearing/config...');
      const r1 = await fetch('http://localhost:3001/api/v1/ce-clearing/config', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const j1 = await r1.json();
      console.log('Config status:', r1.status);
      console.log('Config data:', JSON.stringify(j1.data || j1, null, 2));

      console.log('\\n2. Testing POST /api/v1/ce-clearing/lot-statistics/run-lot (Draft test)...');
      const r2 = await fetch('http://localhost:3001/api/v1/ce-clearing/lot-statistics/run-lot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ date: '2026-10-22', exportDraft: true })
      });
      const j2 = await r2.json();
      console.log('Run-lot Draft status:', r2.status);
      console.log('Run-lot Draft result:', JSON.stringify(j2, null, 2));
    }

    test().catch(e => console.error(e));
  `;

  conn.exec(`cat << 'EOF' > /tmp/test_ce_config.js\n${remoteScript}\nEOF\nNODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/test_ce_config.js\nrm -f /tmp/test_ce_config.js`, (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
});
conn.connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
