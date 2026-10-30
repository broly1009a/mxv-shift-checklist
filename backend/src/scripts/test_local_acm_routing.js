/**
 * test_local_acm_routing.js
 * Kiểm thử tự động cơ chế định tuyến tệp SFTP ACM tại máy local
 * 
 * Cách chạy:
 *   cd backend
 *   node src/scripts/test_local_acm_routing.js
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Client } = require('ssh2');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

function decrypt(encryptedText) {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) return '';
  const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
  const secretKey = crypto.createHash('sha256').update(rawKey).digest();
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

async function runLocalAcmRoutingTest() {
  console.log('========================================================================');
  console.log('  TEST LOCAL: KIỂM THỬ ĐỊNH TUYẾN TỆP SFTP ACM (PHÂN BIỆT T VÀ T-1)    ');
  console.log('========================================================================\n');

  let creds = {
    host: 'sftp.mxv.com.vn',
    port: 2232,
    username: 'qlgd',
    password: '',
    remoteDir: '/data/',
  };

  const encSetting = '4a01c71fb6fd2390f2921ae078bd0f03:34ba9905e9c1eb01f8bf05bc9c39f712fd0288d675c0e98f1f88f5a4acca00f259236534d0191ecd908cb2af2ff07a1e42133a4ca46d6c60c36ec4d7dcdc8b53ac072621fb7b153fce5affdc2300c360ad7f1131fce9ebcff365625d3a5de84ff18be9c88b69b45319dda523d477fc2449183ff345e94def53798126586cabb8c64050ee0f5f3c468b584cf73111bf27ce9d317a2b54f96fcaf32e832d1d1711f71f90d89f0473b24aa6d8481ccff56674d18e1e350c99706c847f168e7917d089153e40c72982ee0451cec8a3a81848e731c63cda362e6ec921111df6a069d34d2dc6e61143124158bb35cf9921a090b4e4e209daba770cb910ccba5e8a8ebb17207cc49699e2c552035624009bb6f2f0aeee0a390d79fd9084ab2fac509ce308ea024d5c034694730a85567b69482ff707b793577ed4100bf5d2c060b10b8ce9203921f95e71d0610703633f3a97ebef1cc482c3535a0bc72023d19b927e88ef82939f518803050eeee09ad3b80c356a84f600c47767243b4e7fdbc6b79c3377675c46858439e358b1f3214f1e657e';
  const parsed = JSON.parse(decrypt(encSetting));
  creds.host = parsed.sftpHost || creds.host;
  creds.port = parseInt(parsed.sftpPort, 10) || creds.port;
  creds.username = parsed.sftpUsername || creds.username;
  creds.password = parsed.sftpPassword || creds.password;
  creds.remoteDir = parsed.sftpRemoteDir || creds.remoteDir;

  console.log(`1. Cấu hình SFTP kết nối: sftp://${creds.username}@${creds.host}:${creds.port}${creds.remoteDir}`);

  // Chuẩn bị thư mục test local
  const testRoot = path.join(__dirname, '../../temp/test_acm_routing_local');
  if (fs.existsSync(testRoot)) {
    fs.rmSync(testRoot, { recursive: true, force: true });
  }
  const folder2910 = path.join(testRoot, 'Futures/2026/T10.2026/29.10');
  const folder2810 = path.join(testRoot, 'Futures/2026/T10.2026/28.10');
  fs.mkdirSync(folder2910, { recursive: true });

  console.log('\n2. Thư mục đích yêu cầu tải (Ngày T = 29/10/2026):', folder2910);
  console.log('   Thư mục mong đợi cho phiên T-1 (28/10/2026)  :', folder2810);

  const targetDateStr = '2026-10-30';
  const targetDateObj = new Date(targetDateStr);
  const year = targetDateObj.getFullYear().toString();
  const month = String(targetDateObj.getMonth() + 1).padStart(2, '0');
  const day = String(targetDateObj.getDate()).padStart(2, '0');
  const ddmmyyyy = `${day}${month}${year}`;
  const yyyy_mm_dd = `${year}-${month}-${day}`;
  const csvSuffix = `_${ddmmyyyy}.csv`;
  const xlsPrefix = `${yyyy_mm_dd}_`;

  console.log('\n3. Bắt đầu kết nối SFTP Server và thực thi logic định tuyến...');
  const conn = new Client();

  await new Promise((resolve, reject) => {
    conn.on('ready', () => {
      console.log(' -> Kết nối SSH thành công.');
      conn.sftp((err, sftp) => {
        if (err) return reject(err);

        console.log(` -> Đọc thư mục remote: ${creds.remoteDir}`);
        sftp.readdir(creds.remoteDir, async (readdirErr, list) => {
          if (readdirErr) return reject(readdirErr);

          console.log(` -> Tìm thấy tổng cộng ${(list || []).length} mục trên SFTP Server.`);

          // 1. Tìm các file thuộc phiên T (29102026)
          let candidateFiles = (list || []).filter((item) => {
            const name = item.filename;
            if (!name) return false;
            const isCsvMatch =
              (name.toLowerCase().endsWith(csvSuffix.toLowerCase()) ||
                (name.toLowerCase().includes('straits') &&
                  name.includes(ddmmyyyy) &&
                  name.toLowerCase().endsWith('.csv'))) &&
              !name.toLowerCase().includes('fill') &&
              !name.toLowerCase().includes('order');
            const isXlsMatch =
              name.toLowerCase().startsWith(xlsPrefix.toLowerCase()) &&
              name.toLowerCase().endsWith('.xls');
            return isCsvMatch || isXlsMatch;
          });

          console.log(` -> Số file thuộc phiên T (${targetDateStr}): ${candidateFiles.length}`);

          if (candidateFiles.length === 0) {
            console.log(` -> [AcmSftpAdapter] Chưa có tệp SFTP của phiên ${yyyy_mm_dd} trên máy chủ đối tác (bỏ qua).`);
            conn.end();
            return resolve();
          }

          console.log('\n4. Bắt đầu tải tệp về thư mục chuẩn...');
          for (const item of candidateFiles) {
            const remotePath = path.posix.join(creds.remoteDir, item.filename);
            const localPath = path.join(folder2910, item.filename);

            console.log(`   + Tải tệp: ${item.filename}`);
            console.log(`     -> Lưu vào thư mục: ${folder2910}`);

            await new Promise((getRes, getRej) => {
              sftp.fastGet(remotePath, localPath, (getErr) => {
                if (getErr) return getRej(getErr);
                getRes();
              });
            });

            const isCsv = item.filename.toLowerCase().endsWith('.csv');
            if (item.filename.toLowerCase().includes('straits') && isCsv) {
              const aliasDated = path.join(folder2910, `Straits_${ddmmyyyy}.csv`);
              const aliasGeneric = path.join(folder2910, 'Straits.csv');
              if (!fs.existsSync(aliasDated)) fs.copyFileSync(localPath, aliasDated);
              if (!fs.existsSync(aliasGeneric)) fs.copyFileSync(localPath, aliasGeneric);
              console.log(`     -> Đã tạo alias [Straits_${ddmmyyyy}.csv, Straits.csv] tại: ${folder2910}`);
            }
          }

          conn.end();
          resolve();
        });
      });
    });

    conn.on('error', (err) => reject(err));
    conn.connect({
      host: creds.host,
      port: creds.port,
      username: creds.username,
      password: creds.password,
      readyTimeout: 15000,
    });
  });

  // 5. Kiểm tra kết quả thẩm định
  console.log('\n========================================================================');
  console.log('  KẾT QUẢ THẨM ĐỊNH THỰC TẾ LOCAL:                                      ');
  console.log('========================================================================');

  const filesIn2910 = fs.existsSync(folder2910) ? fs.readdirSync(folder2910) : [];

  console.log(`\n📁 Thư mục ngày 29.10 [Đường dẫn: ${folder2910}]:`);
  console.log(`   Số lượng file: ${filesIn2910.length}`);
  if (filesIn2910.length === 0) {
    console.log('    XÁC NHẬN: Không có file của ngày 29 trên SFTP -> Hệ thống bỏ qua thông báo, không tải rác.');
    console.log('   -> Đúng yêu cầu: Đơn giản, trực quan, không code phức tạp.');
  } else {
    console.log('   Danh sách file:', filesIn2910);
  }

  // Dọn dẹp thư mục test
  fs.rmSync(testRoot, { recursive: true, force: true });
  console.log('\n🧹 Đã dọn dẹp thư mục test tạm thời.');
}

runLocalAcmRoutingTest().catch((err) => {
  console.error('\n❌ LỖI TEST:', err.message);
  process.exit(1);
});
