const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const targetAccounts = [
  { code: '003C2311200', name: 'HOÀNG KIM CÔNG' },
  { code: '085C0947827', name: 'NGUYỄN VĂN THỊNH' },
  { code: '003C0879444', name: 'LÊ HUỲNH HÙNG' },
  { code: '003C0534241', name: 'PHAN TẤN NHỰT' },
  { code: '003C1564927', name: 'NGUYỄN HUỲNH NHƯ' },
  { code: '003C0807375', name: 'TRƯƠNG CẨM TÚ' },
  { code: '003C1731326', name: 'TRƯƠNG NGỌC THU' },
  { code: '003C1684879', name: 'NGUYỄN VĂN HỢI' },
  { code: '003C6550243', name: 'HUỲNH TUYẾT MAI' },
  { code: '003C1684184', name: 'NGUYỄN TRIỆU HƯNG' },
  { code: '003C1669379', name: 'TRƯƠNG HUY HOÀNG' },
  { code: '003C0094629', name: 'NGUYÊN HOÀNG MAI' },
  { code: '003C9052476', name: 'HUỲNH THỊ KIM NGÂN' },
  { code: '003C1719053', name: 'LÊ THỊ THU HÒA' },
];

const remoteScript = `
cd /opt/mxv-checklist/backend && node -e '
require("dotenv").config({ path: "/opt/mxv-checklist/backend/.env" });
const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const targets = ${JSON.stringify(targetAccounts)};
const outDir = "/opt/mxv-checklist/backend/data/audit_14_accounts";
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function getAccessToken() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const tkgd = await db.collection("tkgd_user_configs").findOne({ userEmail: "hieptruong@mxv.vn" });
  let refreshToken = tkgd?.outlook?.refreshToken;
  if (!refreshToken) {
    const sys = await db.collection("system_settings").findOne({ key: "m365_refresh_token" });
    refreshToken = sys?.value;
  }
  await client.close();

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID || "common";

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
  if (!res.ok) throw new Error("Token refresh failed: " + res.status + " " + await res.text());
  const data = await res.json();
  return data.access_token;
}

async function searchAndDownload() {
  const token = await getAccessToken();
  console.log("Token retrieved successfully.");

  const results = [];

  for (const t of targets) {
    console.log("\\n>>> SEARCHING FOR:", t.code, t.name);
    const accDir = path.join(outDir, t.code);
    if (!fs.existsSync(accDir)) fs.mkdirSync(accDir, { recursive: true });

    // Try search by code first, then by raw number
    let query = t.code;
    let url = "https://graph.microsoft.com/v1.0/me/messages?\\$search=\\"" + encodeURIComponent(query) + "\\"&\\$top=5&\\$select=id,subject,from,receivedDateTime,hasAttachments";
    let resp = await fetch(url, { headers: { Authorization: "Bearer " + token } });
    let data = resp.ok ? await resp.json() : null;

    if (!data || !data.value || data.value.length === 0) {
      // Try search by without prefix (e.g. 2311200 or 0947827)
      const numOnly = t.code.replace(/^[^0-9]+/, "").replace(/^[0-9]{3}[A-Z]/, "");
      console.log("  Retry search with numOnly:", numOnly);
      url = "https://graph.microsoft.com/v1.0/me/messages?\\$search=\\"" + encodeURIComponent(numOnly) + "\\"&\\$top=5&\\$select=id,subject,from,receivedDateTime,hasAttachments";
      resp = await fetch(url, { headers: { Authorization: "Bearer " + token } });
      data = resp.ok ? await resp.json() : null;
    }

    if (!data || !data.value || data.value.length === 0) {
      // Try search by name
      console.log("  Retry search with name:", t.name);
      url = "https://graph.microsoft.com/v1.0/me/messages?\\$search=\\"" + encodeURIComponent(t.name) + "\\"&\\$top=5&\\$select=id,subject,from,receivedDateTime,hasAttachments";
      resp = await fetch(url, { headers: { Authorization: "Bearer " + token } });
      data = resp.ok ? await resp.json() : null;
    }

    const messages = data?.value || [];
    console.log("  Found messages count:", messages.length);

    const accResult = {
      code: t.code,
      name: t.name,
      messages: [],
      downloadedFiles: []
    };

    for (const msg of messages) {
      console.log("    Msg:", msg.id.slice(0, 20) + "...", "Subj:", msg.subject, "From:", msg.from?.emailAddress?.address, "HasAttach:", msg.hasAttachments);
      accResult.messages.push({
        id: msg.id,
        subject: msg.subject,
        from: msg.from?.emailAddress?.address,
        receivedDateTime: msg.receivedDateTime,
      });

      if (msg.hasAttachments) {
        // fetch attachments
        const attUrl = "https://graph.microsoft.com/v1.0/me/messages/" + msg.id + "/attachments";
        const attResp = await fetch(attUrl, { headers: { Authorization: "Bearer " + token } });
        if (attResp.ok) {
          const attData = await attResp.json();
          for (const a of (attData.value || [])) {
            console.log("      Attachment:", a.name, a.contentType, a.size);
            if (a.contentBytes) {
              const safeName = (a.name || "attach_" + Date.now()).replace(/[^a-zA-Z0-9._-]/g, "_");
              const filePath = path.join(accDir, safeName);
              fs.writeFileSync(filePath, Buffer.from(a.contentBytes, "base64"));
              accResult.downloadedFiles.push({
                name: a.name,
                localPath: filePath,
                size: a.size,
                contentType: a.contentType
              });
            }
          }
        }
      }
    }

    results.push(accResult);
  }

  const summaryPath = path.join(outDir, "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log("\\n>>> DONE! Summary saved to:", summaryPath);
}

searchAndDownload().catch(console.error);
'
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected to Ubuntu. Starting search and download...');
  conn.exec(remoteScript, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', code => {
      console.log('\nFinished with code:', code);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});
