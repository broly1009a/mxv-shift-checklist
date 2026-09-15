const { Client } = require('ssh2');

const testRemoteScript = `
cd /opt/mxv-checklist/backend && node -e '
require("dotenv").config({ path: "/opt/mxv-checklist/backend/.env" });
const { MongoClient } = require("mongodb");

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  // Get refresh token from tkgd_user_configs or system_settings
  const tkgd = await db.collection("tkgd_user_configs").findOne({ userEmail: "hieptruong@mxv.vn" });
  let refreshToken = tkgd?.outlook?.refreshToken;
  if (!refreshToken) {
    const sys = await db.collection("system_settings").findOne({ key: "m365_refresh_token" });
    refreshToken = sys?.value;
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID || "common";

  console.log("Connecting to Microsoft OAuth with clientId:", clientId?.slice(0, 8) + "...");
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: "https://graph.microsoft.com/.default offline_access",
  });

  const res = await fetch("https://login.microsoftonline.com/" + tenantId + "/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("TOKEN_ERROR:", res.status, text);
    process.exit(1);
  }

  const data = await res.json();
  console.log("TOKEN_SUCCESS: Access token acquired, expires in:", data.expires_in);

  // Test call /me
  const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: "Bearer " + data.access_token }
  });
  console.log("ME_RES:", meRes.status, await meRes.text());

  await client.close();
}
run().catch(console.error);
'
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(testRemoteScript, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => out += d);
    stream.on('close', code => {
      console.log('CODE:', code);
      console.log(out);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});
