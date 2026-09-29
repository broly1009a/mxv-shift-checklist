const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
  const nodeScript = `
    const mongoose = require('mongoose');

    async function inspect() {
      const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/mxv_shift_checklist').asPromise();
      const tokenSetting = await conn.db.collection('system_settings').findOne({ key: 'm365_refresh_token' });
      const refreshToken = tokenSetting?.value;
      const tenantId = 'b83638b2-3312-4ed3-84dd-fcc24c5d76a2';
      const clientId = 'c35a8ea2-a975-4b22-bd22-f490f80931ce';
      const clientSecret = 'vgq8Q~KG65lizTdASJOphg~06XRlVDZadMf_daD8';
      const watcherEmail = 'hieptruong@mxv.vn';

      // 1. Get Access token
      const tokenUrl = 'https://login.microsoftonline.com/' + tenantId + '/oauth2/v2.0/token';
      const params = new URLSearchParams();
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', refreshToken);
      params.append('scope', 'https://graph.microsoft.com/.default');

      const tokenRes = await fetch(tokenUrl, { method: 'POST', body: params });
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      const filter = "receivedDateTime ge 2026-09-15T00:00:00Z";
      const searchUrl = 'https://graph.microsoft.com/v1.0/users/' + watcherEmail + '/messages?$filter=' + encodeURIComponent(filter) + '&$top=50&$orderby=receivedDateTime desc';
      const listRes = await fetch(searchUrl, { headers: { Authorization: 'Bearer ' + accessToken } });
      const listData = await listRes.json();

      const realEodMail = eodMails.find(m => m.hasAttachments);
      console.log('Real EOD Mail:', realEodMail?.subject, realEodMail?.receivedDateTime, realEodMail?.id);

      if (realEodMail) {
        const attUrl = 'https://graph.microsoft.com/v1.0/users/' + watcherEmail + '/messages/' + realEodMail.id + '/attachments';
        const attRes = await fetch(attUrl, { headers: { Authorization: 'Bearer ' + accessToken } });
        const attData = await attRes.json();
        console.log('Att count in real mail:', attData.value?.length);
        attData.value?.forEach(a => console.log('File:', a.name, a.size, 'bytes'));
      }

      await conn.close();
      process.exit(0);
    }
    inspect().catch(console.error);
  `;
  const b64 = Buffer.from(nodeScript).toString('base64');
  const cmd = `cd /opt/mxv-checklist/backend && node -e "eval(Buffer.from('${b64}', 'base64').toString())"`;
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    let output = '';
    stream.on('data', (d) => { output += d.toString(); });
    stream.stderr.on('data', (d) => { output += d.toString(); });
    stream.on('close', () => {
      console.log(output);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
