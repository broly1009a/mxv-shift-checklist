let Server;
try {
  Server = require('ssh2').Server;
} catch (e) {
  try {
    Server = require('../backend/node_modules/ssh2').Server;
  } catch (err) {
    console.error('❌ Lỗi: Chưa cài đặt thư viện ssh2. Vui lòng chạy `npm install`!');
    process.exit(1);
  }
}
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Tự động tạo cặp khóa RSA cho Host SSH ngầm trên bộ nhớ
const keyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});
const privateKey = keyPair.privateKey;

const PORT = 2231;
const USERNAME = 'testuser';
const PASSWORD = '123456';

// Thư mục chứa file SFTP mẫu
const SFTP_ROOT = path.join(__dirname, 'data');
if (!fs.existsSync(SFTP_ROOT)) {
  fs.mkdirSync(SFTP_ROOT, { recursive: true });
}

// 1. Hàm sinh file ACM mẫu chuẩn nghiệp vụ cho 1 ngày chỉ định
function generateDailyAcmFiles(targetDate = new Date()) {
  const yyyy = targetDate.getFullYear().toString();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  const ddmmyyyy = `${dd}${mm}${yyyy}`;
  const yyyy_mm_dd = `${yyyy}-${mm}-${dd}`;
  const yyyymmdd = `${yyyy}${mm}${dd}`;
  const dateShort = `${dd}-${mm}-${yyyy.substring(2)}`;

  // 1. File Straits Trading CSV (*_<DDMMYYYY>.csv)
  const STRAITS_HEADER = `Trade Date,Trade Type,Buy,Sell,Exchange Code,Product Type,Product Code,Contract Mth/PD,Call/Put,Strike Price,Sub-A/C,Contract Description,Price,CC,Premium Amt,Commission,Remarks,Execution Date-time,Broker Trade ID\n`;
  const straitsCsvRows =
    STRAITS_HEADER +
    `${dateShort},Normal,10,,ACM,FUT,NSI,2609,,,10017890000,Sep 2026 ACM Nano Silver,58.6,USD,,,,${dateShort} 20:45,EP1728137\n` +
    `${dateShort},Normal,,5,ACM,FUT,NSI,2609,,,10017890000,Sep 2026 ACM Nano Silver,58.6,USD,,,,${dateShort} 20:47,EP1728138\n`;

  const csvPath = path.join(
    SFTP_ROOT,
    `EOD FO trades_PT Straits Financial Indonesia - 10017890000_${ddmmyyyy}.csv`,
  );
  if (!fs.existsSync(csvPath)) {
    fs.writeFileSync(csvPath, straitsCsvRows, 'utf-8');
    console.log(`[SFTP Daily 05:00 AM] Generated Straits CSV file: ${path.basename(csvPath)}`);
  }

  // 2. File Báo cáo chi tiết tài khoản ACM XLS (<YYYY-MM-DD>_10017890000.xls) chuẩn 18 cột
  const ACM_XLS_HEADER = `CM Account\tPosition Account\tInstrument Id\tUser Id\tOrder Price Type\tB/S\tClOrdID\tStop Price\tLimit Price\tVolume Total\tVolume Traded\tVolume Total\tTime Condition\tGtd Date\tExchange Id\tTrader Id\tTrading Day\tOrder Sy Id\n`;
  const acmXlsRows =
    ACM_XLS_HEADER +
    `1001B\t10017890000\tF-XACM-NSI-202612\t068C0886789-A\tLimit\tB\t100001234567\t0\t61\t3\t0\t0\tGTC\t\tXACM\t068C0886789-A\t${yyyymmdd}\t${yyyymmdd}0001\n` +
    `1001B\t10017890000\tF-XACM-NSI-202609\t068C0886789-A\tLimit\tB\t100001234568\t0\t60.31\t3\t3\t0\tGTC\t\tXACM\t068C0886789-A\t${yyyymmdd}\t${yyyymmdd}0002\n` +
    `1001B\t10017890000\tF-XACM-NSI-202609\t068C0886789-A\tStop\tS\t100001234569\t57.56\t0\t3\t0\t0\tGTC\t\tXACM\t068C0886789-A\t${yyyymmdd}\t${yyyymmdd}0003\n` +
    `1001B\t10017890000\tF-XACM-NSI-202609\t068C0886789-A\tLimit\tS\t100001234570\t0\t63.06\t3\t0\t0\tGTC\t\tXACM\t068C0886789-A\t${yyyymmdd}\t${yyyymmdd}0004\n` +
    `1001B\t10017890000\tF-XACM-NSI-202609\t068C0886789-A\tStop\tS\t100001234571\t59.6\t0\t3\t0\t0\tGTC\t\tXACM\t068C0886789-A\t${yyyymmdd}\t${yyyymmdd}0005\n` +
    `1001B\t10017890000\tF-XACM-NCP-202609\t003C0250977-A\tLimit\tB\t100001234572\t0\t6.163\t1\t0\t0\tGTC\t\tXACM\t003C0250977-A\t${yyyymmdd}\t${yyyymmdd}0006\n` +
    `1001B\t10017890000\tF-XACM-NSI-202609\t012C3156827-A\tLimit\tS\t100001234573\t0\t61.8\t2\t0\t0\tGFD\t\tXACM\t012C3156827-A\t${yyyymmdd}\t${yyyymmdd}0007\n`;

  const xlsPath = path.join(SFTP_ROOT, `${yyyy_mm_dd}_10017890000.xls`);
  if (!fs.existsSync(xlsPath)) {
    fs.writeFileSync(xlsPath, acmXlsRows, 'utf-8');
    console.log(`[SFTP Daily 05:00 AM] Generated ACM Detail XLS file: ${path.basename(xlsPath)}`);
  }
}

// 2. Lập lịch tự động sinh file mới lúc 05:00 AM hàng ngày & tự động bù file nếu bị miss
function checkAndScheduleDailyGenerator() {
  const now = new Date();

  // Tự động kiểm tra bù: Nếu ngày hôm nay chưa có file (vd server bật sau 5h sáng), tự động tạo bù ngay!
  generateDailyAcmFiles(now);

  // Tính thời gian chờ đến 05:00 AM tiếp theo
  const next5AM = new Date(now);
  if (now.getHours() >= 5) {
    next5AM.setDate(next5AM.getDate() + 1);
  }
  next5AM.setHours(5, 0, 0, 0);

  const msUntil5AM = next5AM.getTime() - now.getTime();
  console.log(
    `[SFTP Scheduler] Lịch sinh file tự động: 05:00 AM ngày ${next5AM.toLocaleDateString()} (sau ${Math.round(
      msUntil5AM / 60000,
    )} phút).`,
  );

  setTimeout(() => {
    generateDailyAcmFiles(new Date());
    // Đặt lịch lặp lại mỗi 24 tiếng (86400000 ms)
    setInterval(() => {
      generateDailyAcmFiles(new Date());
    }, 24 * 60 * 60 * 1000);
  }, msUntil5AM);
}

// Kích hoạt bộ sinh file 5h sáng & tự bù file miss
checkAndScheduleDailyGenerator();

// Khởi chạy SFTP Server
const server = new Server(
  { hostKeys: [privateKey] },
  (client) => {
    let authenticatedUser = '';

    client.on('authentication', (ctx) => {
      if (
        ctx.username === USERNAME &&
        ctx.method === 'password' &&
        ctx.password === PASSWORD
      ) {
        authenticatedUser = ctx.username;
        return ctx.accept();
      }
      console.log(`[SFTP Auth Fail] Failed login for user '${ctx.username}'`);
      return ctx.reject(['password']);
    });

    client.on('ready', () => {
      console.log(`[SFTP Status] Client authenticated: ${authenticatedUser}`);

      client.on('session', (accept) => {
        const session = accept();

        session.on('sftp', (accept) => {
          console.log('[SFTP Status] SFTP session established');
          const sftp = accept();
          const openHandles = new Map();

          sftp.on('REALPATH', (reqId, p) => {
            let normalized = p.replace(/\\/g, '/');
            if (normalized === '.' || normalized === '/' || normalized === '') {
              normalized = '/data';
            }
            sftp.name(reqId, [
              {
                filename: normalized,
                longname: `drwxr-xr-x 1 ${USERNAME} ${USERNAME} 4096 Jan 1 00:00 ${normalized}`,
                attrs: {
                  mode: 0o40755,
                  uid: 1000,
                  gid: 1000,
                  size: 4096,
                  atime: Math.floor(Date.now() / 1000),
                  mtime: Math.floor(Date.now() / 1000),
                },
              },
            ]);
          });

          sftp.on('STAT', (reqId, p) => handleStat(reqId, p, sftp));
          sftp.on('LSTAT', (reqId, p) => handleStat(reqId, p, sftp));

          function handleStat(reqId, p, sftpInstance) {
            const localPath = resolveLocalPath(p);
            try {
              const stat = fs.statSync(localPath);
              sftpInstance.attrs(reqId, getSftpAttrs(stat));
            } catch (err) {
              sftpInstance.status(reqId, 2);
            }
          }

          sftp.on('OPENDIR', (reqId, p) => {
            const localPath = resolveLocalPath(p);
            if (fs.existsSync(localPath) && fs.statSync(localPath).isDirectory()) {
              const handleBuf = Buffer.from(`dir-${Math.random().toString(36).substring(2)}`);
              openHandles.set(handleBuf.toString('hex'), { type: 'dir', path: localPath, readEof: false });
              sftp.handle(reqId, handleBuf);
            } else {
              sftp.status(reqId, 2);
            }
          });

          sftp.on('READDIR', (reqId, handleBuf) => {
            const handleKey = handleBuf.toString('hex');
            const h = openHandles.get(handleKey);
            if (!h || h.type !== 'dir') return sftp.status(reqId, 4);
            if (h.readEof) return sftp.status(reqId, 1);
            h.readEof = true;
            try {
              const files = fs.readdirSync(h.path);
              const list = files.map((file) => {
                const filePath = path.join(h.path, file);
                const stat = fs.statSync(filePath);
                const isDir = stat.isDirectory();
                const modeStr = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
                return {
                  filename: file,
                  longname: `${modeStr} 1 ${USERNAME} ${USERNAME} ${stat.size} Aug 18 08:00 ${file}`,
                  attrs: getSftpAttrs(stat),
                };
              });
              sftp.name(reqId, list);
            } catch (err) {
              sftp.status(reqId, 4);
            }
          });

          sftp.on('OPEN', (reqId, filename) => {
            console.log(`[SFTP Read File] ${filename}`);
            let localPath = resolveLocalPath(filename);

            // Nếu file bị miss/chưa có, tự động kích hoạt tạo bù dữ liệu mẫu theo đúng ngày được yêu cầu!
            if (!fs.existsSync(localPath)) {
              const csvMatch = filename.match(/_(\d{2})(\d{2})(\d{4})\.csv$/i);
              const xlsMatch = filename.match(/^(\d{4})-(\d{2})-(\d{2})_/i);
              if (csvMatch) {
                const dd = csvMatch[1];
                const mm = csvMatch[2];
                const yyyy = csvMatch[3];
                generateDailyAcmFiles(new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10)));
              } else if (xlsMatch) {
                const yyyy = xlsMatch[1];
                const mm = xlsMatch[2];
                const dd = xlsMatch[3];
                generateDailyAcmFiles(new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10)));
              }
            }

            try {
              const fd = fs.openSync(localPath, 'r');
              const handleBuf = Buffer.from(`file-${Math.random().toString(36).substring(2)}`);
              openHandles.set(handleBuf.toString('hex'), { type: 'file', path: localPath, fd });
              sftp.handle(reqId, handleBuf);
            } catch (err) {
              sftp.status(reqId, 2);
            }
          });

          sftp.on('READ', (reqId, handleBuf, offset, length) => {
            const handleKey = handleBuf.toString('hex');
            const h = openHandles.get(handleKey);
            if (!h || h.type !== 'file' || h.fd === undefined) return sftp.status(reqId, 4);
            const buffer = Buffer.alloc(length);
            try {
              const bytesRead = fs.readSync(h.fd, buffer, 0, length, offset);
              if (bytesRead === 0) {
                sftp.status(reqId, 1);
              } else {
                sftp.data(reqId, buffer.subarray(0, bytesRead));
              }
            } catch (err) {
              sftp.status(reqId, 4);
            }
          });

          sftp.on('CLOSE', (reqId, handleBuf) => {
            const handleKey = handleBuf.toString('hex');
            const h = openHandles.get(handleKey);
            if (h && h.type === 'file' && h.fd !== undefined) {
              try { fs.closeSync(h.fd); } catch (e) {}
            }
            openHandles.delete(handleKey);
            sftp.status(reqId, 0);
          });
        });
      });
    });

    client.on('end', () => console.log('[SFTP Status] Client disconnected'));
    client.on('error', (err) => console.error('[SFTP Error]', err.message));
  },
);

server.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`🚀 Standalone Mock SFTP Server running on port ${PORT}`);
  console.log(`   SFTP Host:        127.0.0.1 (hoặc IP Server)`);
  console.log(`   Port:             ${PORT}`);
  console.log(`   SFTP Username:    ${USERNAME}`);
  console.log(`   SFTP Password:    ${PASSWORD}`);
  console.log(`   Remote Directory: /data/`);
  console.log(`   Local Directory:  ${SFTP_ROOT}`);
  console.log('====================================================');
});

function resolveLocalPath(remotePath) {
  let cleaned = remotePath.replace(/\\/g, '/');
  if (cleaned.startsWith('/data')) {
    cleaned = cleaned.replace(/^\/data\/?/, '');
  } else if (cleaned.startsWith('/')) {
    cleaned = cleaned.substring(1);
  }
  return path.join(SFTP_ROOT, cleaned);
}

function getSftpAttrs(stat) {
  return {
    mode: stat.isDirectory() ? 0o40755 : 0o100644,
    uid: 1000,
    gid: 1000,
    size: stat.size,
    atime: Math.floor(stat.atimeMs / 1000),
    mtime: Math.floor(stat.mtimeMs / 1000),
  };
}
