const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const userConfigColl = mongoose.connection.collection('tkgd_user_configs');
  const userConfig = await userConfigColl.findOne({ userEmail: 'hieptruong@mxv.vn' });

  const tokenRes = await fetch('https://login.microsoftonline.com/' + process.env.MICROSOFT_TENANT_ID + '/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: userConfig.outlook.refreshToken,
    }),
  });
  const accessToken = (await tokenRes.json()).access_token;

  const testcases = [
    { code: '003C1399395', msgId: 'AAMkADg4NzQ3MGEzLThmZDktNDAyOC05MTg1LWI3ZmQ4ZmRiMWJjNABGAAAAAAAKB6_8Ue2cQqTQhAlwC9cUBwCPqzoTO0UbSYcuL7KVsnHLAAAAAAEMAACPqzoTO0UbSYcuL7KVsnHLAABHOoQhAAA=' },
    { code: '003C8946619', msgId: 'AAMkADg4NzQ3MGEzLThmZDktNDAyOC05MTg1LWI3ZmQ4ZmRiMWJjNABGAAAAAAAKB6_8Ue2cQqTQhAlwC9cUBwCPqzoTO0UbSYcuL7KVsnHLAAAAAAEMAACPqzoTO0UbSYcuL7KVsnHLAABHOoQiAAA=' },
    { code: '003C9462626', msgId: 'AAMkADg4NzQ3MGEzLThmZDktNDAyOC05MTg1LWI3ZmQ4ZmRiMWJjNABGAAAAAAAKB6_8Ue2cQqTQhAlwC9cUBwCPqzoTO0UbSYcuL7KVsnHLAAAAAAEMAACPqzoTO0UbSYcuL7KVsnHLAABHOoQjAAA=' },
  ];

  const outDir = path.join(__dirname, '../../data/test_cccd_images');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const tc of testcases) {
    console.log(`Downloading attachments for ${tc.code}...`);
    const aRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${tc.id || tc.msgId}/attachments`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const aData = await aRes.json();
    for (const a of aData.value || []) {
      const filePath = path.join(outDir, `${tc.code}_${a.name}`);
      if (a.contentBytes) {
        fs.writeFileSync(filePath, Buffer.from(a.contentBytes, 'base64'));
        console.log(`  Saved: ${filePath} (${a.size} bytes)`);
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
