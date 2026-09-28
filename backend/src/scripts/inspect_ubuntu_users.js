const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `cd /opt/mxv-checklist/backend && node -e "
    require('dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
    const mongoose = require('mongoose');
    mongoose.connect(process.env.MONGODB_URI).then(async () => {
      const users = await mongoose.connection.db.collection('users').find({}).toArray();
      console.log('TOTAL USERS IN DB:', users.length);
      users.forEach(u => {
        console.log({
          username: u.username,
          fullName: u.fullName,
          role: u.role,
          isActive: u.isActive,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt
        });
      });
      process.exit(0);
    });
  "`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
