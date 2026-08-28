import * as path from 'path';
import * as fs from 'fs';
import { ValueStatisticsService } from '../modules/lot-statistics/value-statistics.service';

async function runTest() {
  console.log('===============================================================');
  console.log('🧪 KIỂM THỬ XUẤT FILE BẢN TIN TRÊN UBUNTU SERVER');
  console.log('===============================================================');

  // Xác định targetRoot: Ưu tiên đường dẫn mount trên Ubuntu, nếu không có thì lấy thư mục cục bộ
  let targetRoot = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong';
  if (!fs.existsSync(targetRoot)) {
    const localCandidates = [
      'M:/Tailieuchung/QLGD-IT/Quanlygiaodich/Tai lieu hoat dong',
      path.join(process.cwd(), 'Marco thong ke gia tri'),
      path.join(process.cwd(), '..', 'Marco thong ke gia tri'),
      path.join(process.cwd(), 'marco'),
      path.join(process.cwd(), '..', 'marco'),
    ];
    targetRoot = localCandidates.find((p) => fs.existsSync(p)) || process.cwd();
  }

  console.log(`📂 Thư mục gốc kiểm thử (Target Root): ${targetRoot}`);

  const mockSettingsService: any = {
    getSetting: async (key: string, defaultVal: string = '') => defaultVal,
  };

  const service = new ValueStatisticsService(mockSettingsService);

  // Tạo mock dữ liệu GTGD của các mặt hàng chính
  const mockGtgdMap = new Map<string, number>();
  mockGtgdMap.set('ZLE', 849563677560);
  mockGtgdMap.set('ZCE', 545914872750);
  mockGtgdMap.set('ZSE', 612439330750);
  mockGtgdMap.set('ZME', 514661599400);
  mockGtgdMap.set('ZWA', 1689831656500);
  mockGtgdMap.set('CPE', 234919990500);
  mockGtgdMap.set('SIE', 644448629500);
  mockGtgdMap.set('SI5CO', 199071939300);

  const testDate = new Date();
  const logs: string[] = [];

  console.log('⏳ Đang thực thi hàm xuất file bản tin...');
  const generateNewsletter = (service as any).generateNewsletterFile.bind(service);
  
  await generateNewsletter(targetRoot, testDate, mockGtgdMap, logs);

  console.log('\n--- KẾT QUẢ GHI NHẬN ---');
  logs.forEach((log) => console.log(log));

  console.log('===============================================================');
  console.log('🎉 HOÀN TẤT KIỂM THỬ XUẤT FILE BẢN TIN!');
  console.log('===============================================================');
}

runTest().catch((err) => {
  console.error('❌ Lỗi kiểm thử:', err.message);
  process.exit(1);
});
