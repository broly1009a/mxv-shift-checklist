const { Client } = require('ssh2');

const conn = new Client();

console.log('Connecting SSH to Ubuntu (10.0.0.26) to inspect real TTTT files and real API response...');

conn.on('ready', () => {
  const remoteScript = `
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    const mongoose = require('mongoose');
    const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

    function decrypt(encryptedText, encKey) {
      if (!encryptedText) return '';
      const parts = encryptedText.split(':');
      if (parts.length !== 2) return '';
      const rawKey = encKey || 'mxv_default_secret_key_32_chars_long!';
      const secretKey = crypto.createHash('sha256').update(rawKey).digest();
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = Buffer.from(parts[1], 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString('utf8');
    }

    // 1. Tìm các file TTTT thực tế trên Ubuntu
    console.log('=== BƯỚC 1: TÌM CÁC FILE TTTT THỰC TẾ TRÊN MÁY CHỦ ===');
    const searchDirs = [
      '/mnt/qlgd-it',
      '/opt/mxv-checklist/data',
      '/opt/mxv-checklist/backend/data',
      '/data/backup',
      '/home/mxvadmin'
    ];

    let foundFiles = [];
    function findFiles(dir, maxDepth = 4, curDepth = 0) {
      if (curDepth > maxDepth || !fs.existsSync(dir)) return;
      try {
        const list = fs.readdirSync(dir);
        for (const item of list) {
          const fullPath = path.join(dir, item);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              if (!item.includes('node_modules') && !item.includes('.git')) {
                findFiles(fullPath, maxDepth, curDepth + 1);
              }
            } else if (/^TTTT.*\\.(xlsx|csv|xls)$/i.test(item) || /^PNL_EXECUTED.*\\.(xlsx|csv)$/i.test(item)) {
              foundFiles.push({ path: fullPath, size: stat.size, mtime: stat.mtime });
            }
          } catch {}
        }
      } catch {}
    }

    for (const d of searchDirs) {
      findFiles(d, 5, 0);
      if (foundFiles.length > 5) break;
    }

    console.log('Tìm thấy ' + foundFiles.length + ' file TTTT mẫu:');
    foundFiles.slice(0, 5).forEach((f, i) => {
      console.log('  ' + (i+1) + '. ' + f.path + ' (' + f.size + ' bytes, ' + f.mtime + ')');
    });

    // 2. Đọc cấu trúc và dữ liệu thực tế của file TTTT mới nhất
    if (foundFiles.length > 0) {
      const sampleFile = foundFiles.sort((a,b) => b.mtime - a.mtime)[0].path;
      console.log('\\n=== BƯỚC 2: PHÂN TÍCH FILE THỰC TẾ: ' + sampleFile + ' ===');
      try {
        const buf = fs.readFileSync(sampleFile);
        let rows = [];
        if (sampleFile.endsWith('.csv')) {
          const wb = XLSX.read(buf.toString('utf-8'), { type: 'string' });
          rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        } else {
          const wb = XLSX.read(buf, { type: 'buffer' });
          rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        }

        console.log('Tổng số dòng: ' + rows.length);
        if (rows.length > 0) {
          console.log('Header (Dòng 1):', JSON.stringify(rows[0]));
        }
        if (rows.length > 1) {
          console.log('Dòng dữ liệu 1:', JSON.stringify(rows[1]));
        }
        if (rows.length > 2) {
          console.log('Dòng dữ liệu 2:', JSON.stringify(rows[2]));
        }
      } catch (err) {
        console.log('Lỗi đọc file TTTT:', err.message);
      }
    } else {
      console.log('Không tìm thấy file TTTT trên các thư mục mặc định, kiểm tra M:\\ qua find command...');
    }

    // 3. Gọi API OMS_PNL_DETAIL thực tế và in chi tiết toàn bộ các trường số tiền
    async function inspectOmsApi() {
      console.log('\\n=== BƯỚC 3: GỌI API OMS_PNL_DETAIL LẤY DỮ LIỆU THẬT & CHI TIẾT TỪNG TRƯỜNG ===');
      await mongoose.connect('mongodb://localhost:27017/mxv_shift_checklist', { serverSelectionTimeoutMS: 5000 });
      const db = mongoose.connection.db;
      
      const credDoc = await db.collection('system_settings').findOne({ key: 'bot_credentials_ccp' });
      const urlDoc = await db.collection('system_settings').findOne({ key: 'coreccp_base_url' });
      const encKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
      const decrypted = JSON.parse(decrypt(credDoc.value, encKey));
      let baseUrl = (urlDoc?.value || decrypted.url || 'https://coreccp.vnclear.vn').replace(/\\/+$/, '');
      baseUrl = new URL(baseUrl).origin;
      const username = decrypted.username;
      const password = decrypted.password;

      // Login
      const CCP_PROD_BASIC_AUTH = 'Basic d2ViLWNjcC1teHY6d1NBbmNpNkpzN3AxWTd2eVdiZjVZajBVc3J5Yjdy';
      const redirectUri = \`\${baseUrl}/validate_code\`;
      const authUrl = \`\${baseUrl}/oauth2/authorize?client_id=web-ccp-mxv&response_type=code&redirect_uri=\${encodeURIComponent(redirectUri)}&scope=openid%20profile\`;

      const initRes = await fetch(authUrl, { redirect: 'manual' });
      const cookies = [];
      const setC = initRes.headers.getSetCookie ? initRes.headers.getSetCookie() : [initRes.headers.get('set-cookie')];
      let csrf = '';
      const html = await initRes.text();
      const m = html.match(/name=["']_csrf["']\\s+value=["']([^"']+)["']/i);
      csrf = m ? m[1] : '';

      const loginRes = await fetch(\`\${baseUrl}/login\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: setC.join('; '),
          Origin: baseUrl,
          Referer: \`\${baseUrl}/login\`,
        },
        body: new URLSearchParams({ _csrf: csrf, username, password, page: 'login_ccp' }).toString(),
        redirect: 'manual',
      });

      const loc = loginRes.headers.get('location');
      const nextCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')];
      const allCookies = [...setC, ...nextCookies].join('; ');

      const code = new URL(loc.startsWith('http') ? loc : \`\${baseUrl}\${loc}\`).searchParams.get('code');

      const tokenRes = await fetch(\`\${baseUrl}/oauth2/token\`, {
        method: 'POST',
        headers: {
          Authorization: CCP_PROD_BASIC_AUTH,
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: allCookies,
          Origin: baseUrl,
        },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }).toString(),
      });
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
      let sessionCookie = '';
      for (const c of nextCookies) {
        const sm = (c || '').match(/SESSION=([^;]+)/i);
        if (sm) sessionCookie = \`SESSION=\${sm[1]}\`;
      }

      console.log('Login CoreCCP thành công. Đang query OMS_PNL_DETAIL...');
      const pnlRes = await fetch(\`\${baseUrl}/ccp/inquiry/OMS_ACM\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'connectkey': 'fsscssiam2021',
          'Cookie': sessionCookie,
          'Authorization': \`Bearer \${accessToken}\`,
          'Origin': baseUrl,
          'Referer': \`\${baseUrl}/MONITOR_OMS/MONITOR_OMS_ACM\`,
        },
        body: JSON.stringify({
          searchcode: 'OMS_PNL_DETAIL',
          search: { accountId: '' },
          page: 1,
          pageSize: 10,
        }),
      });

      const pnlJson = await pnlRes.json();
      const rawData = pnlJson.payload?.data || pnlJson.data || [];
      console.log('Kết quả API trả về (length = ' + (Array.isArray(rawData) ? rawData.length : typeof rawData) + '):');
      
      // In chi tiết toàn bộ key/value của 3 bản ghi đầu tiên
      let count = 0;
      if (Array.isArray(rawData)) {
        for (const entry of rawData) {
          if (entry && typeof entry === 'object') {
            for (const [sym, arr] of Object.entries(entry)) {
              if (Array.isArray(arr)) {
                for (const item of arr) {
                  count++;
                  console.log('\\n--- BẢN GHI ' + count + ' (Symbol: ' + sym + ') ---');
                  console.log(JSON.stringify(item, null, 2));
                  if (count >= 3) break;
                }
              }
              if (count >= 3) break;
            }
          }
          if (count >= 3) break;
        }
      }

      await mongoose.disconnect();
    }

    inspectOmsApi().catch(e => console.error('Lỗi inspectOmsApi:', e));
  `;

  const remoteCmd = `
    cat << 'EOF' > /tmp/inspect_tttt.js
${remoteScript}
EOF
    NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/inspect_tttt.js
    rm -f /tmp/inspect_tttt.js
  `;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
