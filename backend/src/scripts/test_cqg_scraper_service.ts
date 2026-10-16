import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CqgScraperService } from '../modules/ingress/scrapers/cqg-scraper.service';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Script kiểm thử trực tiếp CqgScraperService trong phân hệ Ingress của NestJS
 * 
 * Cách chạy trên Terminal:
 *   cd backend
 *   npx ts-node src/scripts/test_cqg_scraper_service.ts --headed                # Tải mặc định FR (Khớp lệnh) có giao diện
 *   npx ts-node src/scripts/test_cqg_scraper_service.ts --headed --key=PS      # Chỉ tải PS (Tất toán vị thế)
 *   npx ts-node src/scripts/test_cqg_scraper_service.ts --headed --all         # Tải cả 4 tab FR, PS, OP, OD
 *   npx ts-node src/scripts/test_cqg_scraper_service.ts --account=TK2 --all    # Tải cả 4 tab cho tài khoản 2
 */
async function main() {
  console.log('========================================================================');
  console.log('   KIỂM THỬ TRỰC TIẾP CQGSCRAPERSERVICE (NESTJS MODULAR MONOLITH V2)   ');
  console.log('========================================================================\n');

  const args = process.argv.slice(2);
  const isHeaded = args.includes('--headed');
  if (isHeaded) {
    process.env.HEADLESS_BOT = 'false';
    process.env.PLAYWRIGHT_HEADLESS = 'false';
  }

  const isAll = args.includes('--all');
  const keyArg = args.find((a) => a.startsWith('--key='));
  const accountArg = args.find((a) => a.startsWith('--account='));

  const accountType: 'TK1' | 'TK2' = accountArg?.includes('TK2') ? 'TK2' : 'TK1';

  let reports: Array<'FR' | 'PS' | 'OP' | 'OD'> = ['FR'];
  if (isAll) {
    reports = ['FR', 'PS', 'OP', 'OD'];
  } else if (keyArg) {
    const rawKey = keyArg.split('=')[1]?.toUpperCase();
    if (['FR', 'PS', 'OP', 'OD'].includes(rawKey)) {
      reports = [rawKey as any];
    }
  }

  console.log(`- Tài khoản: ${accountType}`);
  console.log(`- Báo cáo cần tải: ${reports.join(', ')}`);
  console.log(`- Chế độ hiển thị: ${isHeaded ? 'HEADED (Mở trình duyệt)' : 'HEADLESS (Chạy ngầm)'}`);

  const outDir = path.resolve(process.cwd(), 'temp', 'test_cqg_service', accountType);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  console.log(`- Thư mục lưu file: ${outDir}\n`);

  console.log('🚀 Đang khởi tạo NestJS Context...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const cqgScraper = app.get(CqgScraperService);
    console.log('✅ Đã resolve CqgScraperService thành công!\n');

    console.log('⏳ Đang tiến hành tải báo cáo qua Playwright...');
    const startTime = Date.now();
    const result = await cqgScraper.downloadCqgReportsViaPlaywright(outDir, accountType, reports);
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n========================================================================');
    console.log(`📊 KẾT QUẢ KIỂM THỬ CQGSCRAPERSERVICE (HOÀN THÀNH TRONG ${durationSec}s):`);
    console.log('========================================================================');
    console.log(JSON.stringify(result, null, 2));

    const filesInDir = fs.readdirSync(outDir).filter((f) => f.endsWith('.xlsx') || f.endsWith('.csv'));
    console.log(`\n📂 Danh sách file tải về trong thư mục (${filesInDir.length} files):`);
    filesInDir.forEach((f) => {
      const stat = fs.statSync(path.join(outDir, f));
      console.log(`  - ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
    });

    console.log('\n🎉 Hoàn thành kiểm thử CqgScraperService.');
  } catch (err: any) {
    console.error('❌ Lỗi khi thực thi CqgScraperService:', err.message);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
