const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { extractHopDongPdf, extractPhuLucPdf } = require('../modules/bot-engine/helpers/tkgd-doc-extractor.helper');

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
  const accessToken = tokenData.access_token;

  const testcases = [
    { code: '003C1399395', id: 'AAMkADg4NzQ3MGEzLThmZDktNDAyOC05MTg1LWI3ZmQ4ZmRiMWJjNABGAAAAAAAKB6_8Ue2cQqTQhAlwC9cUBwCPqzoTO0UbSYcuL7KVsnHLAAAAAAEMAACPqzoTO0UbSYcuL7KVsnHLAABHOoQhAAA=' },
    { code: '003C8946619', id: 'AAMkADg4NzQ3MGEzLThmZDktNDAyOC05MTg1LWI3ZmQ4ZmRiMWJjNABGAAAAAAAKB6_8Ue2cQqTQhAlwC9cUBwCPqzoTO0UbSYcuL7KVsnHLAAAAAAEMAACPqzoTO0UbSYcuL7KVsnHLAABHOoQiAAA=' },
    { code: '003C9462626', id: 'AAMkADg4NzQ3MGEzLThmZDktNDAyOC05MTg1LWI3ZmQ4ZmRiMWJjNABGAAAAAAAKB6_8Ue2cQqTQhAlwC9cUBwCPqzoTO0UbSYcuL7KVsnHLAAAAAAEMAACPqzoTO0UbSYcuL7KVsnHLAABHOoQjAAA=' },
  ];

  for (const tc of testcases) {
    console.log(`\n================== ${tc.code} ==================`);
    const aRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${tc.id}/attachments`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const aJson = await aRes.json();
    for (const a of aJson.value || []) {
      if (a.name.endsWith('.pdf')) {
        console.log(`--- Processing PDF: ${a.name} (${a.size} bytes) ---`);
        const buf = Buffer.from(a.contentBytes, 'base64');
        if (a.name.toLowerCase().includes('pl01')) {
          const pl = await extractPhuLucPdf(buf, a.name);
          console.log('EXTRACTED PHU LUC:', pl);
        } else {
          const hd = await extractHopDongPdf(buf, a.name);
          console.log('EXTRACTED HOP DONG:', hd);
        }
      } else {
        console.log(`Attachment: ${a.name} (${a.contentType}, ${a.size} bytes)`);
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
