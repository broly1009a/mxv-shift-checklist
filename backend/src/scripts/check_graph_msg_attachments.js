const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  await mongoose.connect(MONGODB_URI);
  const userConfigColl = mongoose.connection.collection('tkgd_user_configs');
  
  const userConfig = await userConfigColl.findOne({ userEmail: 'hieptruong@mxv.vn' });
  const refreshToken = userConfig?.outlook?.refreshToken;
  const clientId = userConfig?.outlook?.clientId || process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = userConfig?.outlook?.clientSecret || process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = userConfig?.outlook?.tenantId || process.env.MICROSOFT_TENANT_ID || 'common';

  console.log('Refreshing token...');
  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    console.error('Token err:', tokenData);
    return;
  }
  const accessToken = tokenData.access_token;

  // Let's test the 3 message IDs
  const msgIds = [
    'AAMkADg4NzQ3MGEzLThmZDktNDAyOC05MTg1LWI3ZmQ4ZmRiMWJjNABGAAAAAAAKB6_8Ue2cQqTQhAlwC9cUBwCPqzoTO0UbSYcuL7KVsnHLAAAAAAEMAACPqzoTO0UbSYcuL7KVsnHLAABHOoQhAAA=', // 1399395
    'AAMkADg4NzQ3MGEzLThmZDktNDAyOC05MTg1LWI3ZmQ4ZmRiMWJjNABGAAAAAAAKB6_8Ue2cQqTQhAlwC9cUBwCPqzoTO0UbSYcuL7KVsnHLAAAAAAEMAACPqzoTO0UbSYcuL7KVsnHLAABHOoQiAAA=', // 8946619
    'AAMkADg4NzQ3MGEzLThmZDktNDAyOC05MTg1LWI3ZmQ4ZmRiMWJjNABGAAAAAAAKB6_8Ue2cQqTQhAlwC9cUBwCPqzoTO0UbSYcuL7KVsnHLAAAAAAEMAACPqzoTO0UbSYcuL7KVsnHLAABHOoQjAAA=', // 9462626
  ];

  for (const id of msgIds) {
    console.log('\n--- Checking Message:', id.slice(0, 30) + '... ---');
    const mRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${id}?$select=id,subject,hasAttachments,receivedDateTime`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const mJson = await mRes.json();
    console.log('Message metadata:', mJson);

    const aRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${id}/attachments`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const aJson = await aRes.json();
    console.log('Attachments response count:', aJson.value ? aJson.value.length : 0);
    if (aJson.value) {
      aJson.value.forEach(a => {
        console.log('   Attachment:', a.name, a.contentType, a.size, 'keys:', Object.keys(a), 'hasContentBytes:', !!a.contentBytes);
      });
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
