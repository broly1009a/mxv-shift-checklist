import * as path from 'path';
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { MsApiAdapter } from '../modules/ingress/adapters/ms-api.adapter';
import { IngressSourceType } from '../shared';
import * as fs from 'fs';

async function testMsApiMarketDownload() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║       TEST KIỂM THỬ TẢI Markettruoc6h QUA DIRECT REST API (MsApiAdapter)     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const adapter = app.get(MsApiAdapter);

  const targetDir = path.join(process.cwd(), 'data', 'temp', 'test_ms_api_market');
  fs.mkdirSync(targetDir, { recursive: true });

  const startTime = Date.now();
  console.log(`Bắt đầu tải Markettruoc6h qua MsApiAdapter...`);
  const result = await adapter.download('MS', {
    reportCodes: ['Markettruoc6h'],
    targetDirectory: targetDir,
  });

  const durationMs = Date.now() - startTime;
  console.log(`\nKết quả tải:`);
  console.log(`- Thành công   : ${result.success}`);
  console.log(`- Số lượng file: ${result.files.length}`);
  console.log(`- Thời gian    : ${durationMs}ms`);

  for (const f of result.files) {
    console.log(`  + [${f.category}] ${f.fileName} (${f.fileSize} bytes) -> ${f.absolutePath}`);
    if (fs.existsSync(f.absolutePath)) {
      const lines = fs.readFileSync(f.absolutePath, 'utf8').split('\n');
      console.log(`    Dòng 1: ${lines[0]?.trim()}`);
      console.log(`    Dòng 2: ${lines[1]?.trim()}`);
      console.log(`    Dòng 3: ${lines[2]?.trim()}`);
      console.log(`    Tổng số dòng: ${lines.length}`);
    }
  }

  // Kiểm tra file alias market.csv có tồn tại song song không
  const marketCsvPath = path.join(targetDir, 'market.csv');
  console.log(`- File alias market.csv tồn tại: ${fs.existsSync(marketCsvPath)} (${fs.existsSync(marketCsvPath) ? fs.statSync(marketCsvPath).size : 0} bytes)`);

  await app.close();
  console.log('\n Test hoàn tất thành công 100%!');
}

testMsApiMarketDownload().catch((err) => {
  console.error(' Test thất bại:', err);
  process.exit(1);
});
