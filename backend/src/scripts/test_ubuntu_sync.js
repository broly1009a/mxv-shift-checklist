const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const curlCmd = 'curl -s -X POST http://localhost:3001/api/v1/tkgd/sync-mail -H "Content-Type: application/json" -d \'{"userEmail":"hieptruong@mxv.vn","batchDate":"2026-09-04"}\'';
  conn.exec(curlCmd, (err, stream) => {
    let stdout = '';
    stream.on('data', (d) => (stdout += d.toString()));
    stream.on('close', () => {
      console.log('Sync Mail response:\n', stdout);
      
      // Now run reconciliation
      const reconCmd = 'curl -s -X POST http://localhost:3001/api/v1/tkgd/run -H "Content-Type: application/json" -d \'{"userEmail":"hieptruong@mxv.vn"}\'';
      conn.exec(reconCmd, (err2, stream2) => {
        let stdout2 = '';
        stream2.on('data', (d) => (stdout2 += d.toString()));
        stream2.on('close', () => {
          console.log('\nReconciliation response:\n', stdout2);

          // Now query records for 2026-09-04
          const getCmd = 'curl -s "http://localhost:3001/api/v1/tkgd/records?batchDate=2026-09-04"';
          conn.exec(getCmd, (err3, stream3) => {
            let stdout3 = '';
            stream3.on('data', (d) => (stdout3 += d.toString()));
            stream3.on('close', () => {
              try {
                const data = JSON.parse(stdout3);
                console.log('\nTotal items:', data.total);
                console.log('\n=== ALL 7 ITEMS ON UBUNTU ===');
                data.items?.forEach((item, idx) => {
                  console.log(`\n[${idx + 1}] Mã TKGD: ${item.maTKGD || item.maTKGDBase} | ${item.ms?.hoVaTen}`);
                  console.log('   - Họ tên Mail:', item.noiDungMail?.tenTaiKhoan, 'vs MS:', item.ms?.hoVaTen);
                  console.log('   - CCCD HĐ:', item.hopDong?.soCanCuoc, 'vs MS:', item.ms?.soCMND_HoChieu);
                  console.log('   - Ngày sinh HĐ:', item.hopDong?.ngaySinh, 'vs MS:', item.ms?.ngaySinh);
                  console.log('   - Ngày cấp HĐ:', item.hopDong?.ngayCap, 'vs MS:', item.ms?.ngayCap);
                  console.log('   - Nơi cấp HĐ:', item.hopDong?.noiCap, 'vs MS:', item.ms?.noiCap);
                  console.log('   - Giới tính HĐ:', item.hopDong?.gioiTinh, 'vs MS:', item.ms?.gioiTinh);
                  console.log('   - Kết luận:', item.ketLuan?.trangThai, 'Errors:', item.ketLuan?.danhSachLoi);
                });
              } catch (e) {
                console.log('Parse error:', e.message, '\nRaw:', stdout3.slice(0, 300));
              }
              conn.end();
            });
          });
        });
      });
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 10000,
});
