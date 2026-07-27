import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BotEngineService } from '../modules/bot-engine/bot-engine.service';

async function run() {
  console.log('Booting NestJS application context to run a bot engine tick...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const botEngineService = app.get(BotEngineService);

  console.log('Running handleBotChecks()...');
  await botEngineService.handleBotChecks();

  console.log('Bot engine tick completed successfully!');
  await app.close();
}

run().catch((err) => {
  console.error('❌ Bot engine tick failed:', err);
  process.exit(1);
});
