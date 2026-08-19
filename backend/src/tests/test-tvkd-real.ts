import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ValueStatisticsService } from '../modules/lot-statistics/value-statistics.service';

async function main() {
  // Set env allowed root so it doesn't fail safety check
  process.env.BOT_LOT_MACRO_TARGET_ROOT = "C:\\Users\\hiepth";

  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(ValueStatisticsService);

  const targetDate = new Date('2026-07-16');
  const dsgdPath = "C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures\\2026\\T07.2026\\16.07\\DSGD.xlsx";
  const pathTvkd = "c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\marco\\Thong ke gia tri giao dich có ACM\\Thong ke gia tri giao dich theo TVKD\\Thong ke gia tri giao dich 2026 theo TVKD.xlsx";
  const targetRoot = "C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong";

  console.log(`[TEST-REAL] Booted NestJS context.`);
  console.log(`[TEST-REAL] Running processTvkdOnly for 16/07/2026...`);

  try {
    const result = await service.processTvkdOnly(targetDate, {
      targetRoot,
      dsgdPath,
      pathTvkd,
    });
    console.log(`[TEST-REAL] SUCCESS! TVKD breakdown count:`, Object.keys(result.tvkdGtgdBreakdown).length);
    console.log(`[TEST-REAL] Result values:`, result.tvkdGtgdBreakdown);
  } catch (err: any) {
    console.error(`[TEST-REAL] FAILED with error:`, err.message, err.stack);
  } finally {
    await app.close();
  }
}

main();
