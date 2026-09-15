const { Client } = require('ssh2');

/**
 * Script kiểm thử thực tế trên máy chủ Ubuntu 10.0.0.26 (Read-Only)
 * Đánh giá 3 ca thực tế điển hình:
 * 1. 012C0074622 (Hoàng Văn Long): Ảnh ghép 2 mặt dọc
 * 2. 003C3393939 (Lê Trọng Huy): Ảnh mờ ngày cấp
 * 3. 003C2333888 (Ngô Đức Hải): Ảnh thẻ đơn viền padding đen
 */

const conn = new Client();

const testCases = [
  {
    code: '012C0074622',
    name: 'Hoàng Văn Long (Ảnh ghép 2 mặt dọc - CC HOÀNG VĂN LONG.png)',
    dir: '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-07/012C0074622',
    cmd: 'python3 /opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py --code 012C0074622 --front "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-07/012C0074622/CC HOÀNG VĂN LONG.png"',
  },
  {
    code: '003C3393939',
    name: 'Lê Trọng Huy (Ảnh mờ ngày cấp in hoa văn bảo an)',
    dir: '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-07/003C3393939',
    cmd: 'python3 /opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py --code 003C3393939 --front "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-07/003C3393939/LE-TRONG-HUY-CCCD-truoc.jpg" --back "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-07/003C3393939/LE-TRONG-HUY-CCCD-sau.jpg"',
  },
  {
    code: '003C2333888',
    name: 'Ngô Đức Hải (Thẻ đơn chuẩn có viền đen bao quanh)',
    dir: '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-07/003C2333888',
    cmd: 'python3 /opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py --code 003C2333888 --front "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-07/003C2333888/NGO-DUC-HAI-CCCD-truoc.jpg" --back "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-07/003C2333888/NGO-DUC-HAI-CCCD-sau.jpg"',
  },
];

function runRemoteCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', d => out += d);
      stream.stderr.on('data', d => out += d);
      stream.on('close', () => resolve(out));
    });
  });
}

conn.on('ready', async () => {
  console.log('='.repeat(80));
  console.log(' KIỂM THỬ THỰC TẾ MODULE SCAN CCCD TRÊN SERVER UBUNTU (10.0.0.26)');
  console.log('='.repeat(80));

  for (const tc of testCases) {
    console.log(`\n▶ [${tc.code}] ${tc.name}`);
    try {
      const rawOut = await runRemoteCommand(conn, tc.cmd);
      const jsonStart = rawOut.indexOf('{');
      if (jsonStart >= 0) {
        const parsed = JSON.parse(rawOut.substring(jsonStart).trim());
        const cc = parsed.canCuoc || {};
        console.log(`   ✅ Bóc tách thành công:`);
        console.log(`      • Số CCCD:        ${cc.soCCCD || 'Chưa đọc'}`);
        console.log(`      • Họ và tên:      ${cc.hoTen || 'Chưa đọc'}`);
        console.log(`      • Ngày sinh:      ${cc.ngaySinh || 'Chưa đọc'}`);
        console.log(`      • Ngày cấp:       ${cc.ngayCap || 'Chưa đọc'}`);
        console.log(`      • Nơi cấp:        ${cc.noiCap || 'Chưa đọc'}`);
        console.log(`      • Nguồn đọc:      ${cc.source || '-'}`);
        console.log(`      • Thế hệ thẻ:      ${cc.theGeneration || 'Chưa xác định'}`);
        console.log(`      • Độ tin cậy AI:   ${Math.round((cc.confidenceScore || 0) * 100)}%`);
        console.log(`      • Cảnh báo lỗi:   ${(cc.canhBaoChatLuong && cc.canhBaoChatLuong.length > 0) ? ('⚠ ' + cc.canhBaoChatLuong.join('; ')) : '✓ Hợp lệ 100% (Đủ 4 góc viền)'}`);
      } else {
        console.log(`    Không tìm thấy JSON output:\n${rawOut}`);
      }
    } catch (e) {
      console.log(`   💥 Lỗi: ${e.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(' HOÀN TẤT KIỂM THỬ TRÊN SERVER!');
  console.log('='.repeat(80));
  conn.end();
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
