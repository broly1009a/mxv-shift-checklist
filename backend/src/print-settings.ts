import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SystemSettingsService } from './modules/system-settings/system-settings.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const settingsService = app.get(SystemSettingsService);

  try {
    const keys = [
      'm365_client_id',
      'm365_tenant_id',
      'm365_watcher_email',
      'm365_refresh_token',
      'm365_token_renewed_at',
      'm365_token_error_sent_at',
      'margin_checker_config'
    ];

    console.log('--- SYSTEM SETTINGS IN DB ---');
    for (const key of keys) {
      const val = await settingsService.getSetting(key, '');
      console.log(`${key}: ${val ? (key.includes('token') && key !== 'm365_token_renewed_at' && key !== 'm365_token_error_sent_at' ? '[EXISTS]' : val) : '(EMPTY)'}`);
    }
  } catch (err: any) {
    console.error(err);
  } finally {
    await app.close();
  }
}

run();
