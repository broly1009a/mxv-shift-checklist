import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SystemSettingsService } from './modules/system-settings/system-settings.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const settingsService = app.get(SystemSettingsService);

  const keys = [
    'bot_lot_macro_target_root',
    'bot_lot_macro_path_value',
    'bot_macro_value_path',
    'bot_lot_macro_path',
  ];

  for (const key of keys) {
    const val = await settingsService.getSetting(key, '<not set>');
    console.log(`  ${key} = ${val}`);
  }

  await app.close();
}

main().catch(console.error);
