import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

commands = """
cd /opt/mxv-checklist/backend
node -e '
  const crypto = require("crypto");
  const mongoose = require("mongoose");

  class CookieJar {
    constructor() { this.cookies = new Map(); }
    setFromHeaders(headers) {
      if (!headers) return;
      const setCookieHeaders = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : (headers["set-cookie"] || []);
      const rawCookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
      rawCookies.forEach(str => {
        if (!str) return;
        const parts = str.split(";");
        const nameVal = parts[0];
        const eqIdx = nameVal.indexOf("=");
        if (eqIdx !== -1) {
          this.cookies.set(nameVal.substring(0, eqIdx).trim(), nameVal.substring(eqIdx + 1).trim());
        }
      });
    }
    getCookieHeader() { return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join("; "); }
    getSessionCookie() { const session = this.cookies.get("SESSION"); return session ? `SESSION=${session}` : this.getCookieHeader(); }
  }

  function decrypt(encryptedText, encKey) {
    if (!encryptedText) return "";
    const parts = encryptedText.split(":");
    if (parts.length !== 2) return "";
    const rawKey = encKey || "mxv_default_secret_key_32_chars_long!";
    const secretKey = crypto.createHash("sha256").update(rawKey).digest();
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = Buffer.from(parts[1], "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", secretKey, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString("utf8");
  }

  async function performLogin(baseUrl, username, password) {
    const jar = new CookieJar();
    const loginPageRes = await fetch(`${baseUrl}/login`, { headers: { "User-Agent": "Mozilla/5.0" } });
    jar.setFromHeaders(loginPageRes.headers);
    const authRes = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: jar.getCookieHeader() },
      body: new URLSearchParams({ username, password, submit: "Đăng nhập" }).toString(),
      redirect: "manual"
    });
    jar.setFromHeaders(authRes.headers);
    const oauthRes = await fetch(`${baseUrl}/oauth2/authorize?response_type=code&client_id=web-ccp-mxv&scope=openid&redirect_uri=${baseUrl}/login/oauth2/code/vnclear-client`, {
      headers: { Cookie: jar.getCookieHeader() }, redirect: "manual"
    });
    const loc = oauthRes.headers.get("location") || "";
    const code = new URL(loc).searchParams.get("code");
    const tokenRes = await fetch(`${baseUrl}/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: "Basic d2ViLWNjcC1teHY6d1NBbmNpNkpzN3AxWTd2eVdiZjVZajBVc3J5Yjdy",
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: jar.getCookieHeader()
      },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: `${baseUrl}/login/oauth2/code/vnclear-client` }).toString()
    });
    const tokenData = await tokenRes.json();
    return { token: tokenData.access_token, cookie: jar.getSessionCookie() };
  }

  async function searchMaintain(baseUrl, token, cookie, searchCode, referer) {
    const url = `${baseUrl}/ccp/inquiry/maintain/${searchCode}/search/${searchCode}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Cookie: cookie,
        connectkey: "fsscssiam2021",
        Referer: `${baseUrl}${referer}`
      },
      body: JSON.stringify({
        searchcode: searchCode,
        search: {},
        filter: {},
        orderBy: {},
        page: { pageIndex: 1, pageSize: 200000 }
      })
    });
    return { status: res.status, data: await res.json() };
  }

  async function run() {
    await mongoose.connect("mongodb://localhost:27017/mxv_shift_checklist");
    const credDoc = await mongoose.connection.db.collection("system_settings").findOne({ key: "bot_credentials_ccp" });
    const dec = JSON.parse(decrypt(credDoc.value));
    const baseUrl = "https://coreccp.vnclear.vn";
    const { token, cookie } = await performLogin(baseUrl, dec.username, dec.password);
    console.log("Logged in! Token length:", token.length);

    console.log("1. Testing searchCode OPEN_POSITION...");
    const r1 = await searchMaintain(baseUrl, token, cookie, "OPEN_POSITION", "/ORDERS/OPEN_POSITION");
    const rows1 = r1.data?.data || r1.data?.payload?.data || [];
    console.log("   -> OPEN_POSITION status:", r1.status, "Rows:", rows1.length);
    if (rows1.length > 0) {
      console.log("   -> Row 0 keys:", Object.keys(rows1[0]).slice(0, 8));
      console.log("   -> Row 0 sample:", JSON.stringify(rows1[0]).slice(0, 150));
    }

    console.log("2. Testing searchCode PNL_EXECUTED...");
    const r2 = await searchMaintain(baseUrl, token, cookie, "PNL_EXECUTED", "/ORDERS/PNL_EXECUTED");
    const rows2 = r2.data?.data || r2.data?.payload?.data || [];
    console.log("   -> PNL_EXECUTED status:", r2.status, "Rows:", rows2.length);
    if (rows2.length > 0) {
      console.log("   -> Row 0 keys:", Object.keys(rows2[0]).slice(0, 8));
      console.log("   -> Row 0 sample:", JSON.stringify(rows2[0]).slice(0, 150));
    }

    await mongoose.disconnect();
  }
  run().catch(e => console.error(e));
'
"""

stdin, stdout, stderr = ssh.exec_command(commands)
out = stdout.read().decode('utf-8')
err = stderr.read().decode('utf-8')
if out:
    print(out.encode('ascii', errors='replace').decode('ascii'))
if err:
    print("ERR:", err.encode('ascii', errors='replace').decode('ascii'))
ssh.close()
