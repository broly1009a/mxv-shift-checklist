import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ValueStatisticsService } from '../modules/lot-statistics/value-statistics.service';
import { SystemSettingsService } from '../modules/system-settings/system-settings.service';
import * as fs from 'fs';

async function main() {
  process.env.BOT_LOT_MACRO_TARGET_ROOT = "C:\\Users\\hiepth";

  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(ValueStatisticsService);
  const settingsService = app.get(SystemSettingsService);

  // Set the macro path setting in DB
  const mockMacroPath = "C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke lot va gia tri giao dich.xlsx";
  console.log(`Setting bot_lot_macro_path_value to: ${mockMacroPath}`);
  await settingsService.setSetting('bot_lot_macro_path_value', mockMacroPath);

  const targetDate = new Date('2026-06-22');
  const dsgdPath = "C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures\\2026\\T06.2026\\22.06\\DSGD.xlsx";
  const pathTvkd = "C:\\Users\\hiepth\\Videos\\Thong ke gia tri giao dich theo TVKD\\Thong ke gia tri giao dich 2026 theo TVKD.xlsx";
  const targetRoot = "C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong";

  console.log("Booted NestJS context. Running processTvkdOnly for 22/06/2026...");

  try {
    const result = await service.processTvkdOnly(targetDate, {
      targetRoot,
      dsgdPath,
      pathTvkd,
    });
    console.log("SUCCESS! Result breakdown count:", Object.keys(result.tvkdGtgdBreakdown).length);
    console.log("Result values:", result.tvkdGtgdBreakdown);
  } catch (err: any) {
    console.error("FAILED with error:", err.message, err.stack);
  } finally {
    await app.close();
  }
}

main().catch(console.error);
