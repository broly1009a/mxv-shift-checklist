import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BotJobQueueService } from './modules/bot-engine/bot-job-queue.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const queueService = app.get(BotJobQueueService);

  console.log('Enqueuing FILE_AUDIT_ACM job for 2026-07-22...');
  const job = await queueService.enqueue('FILE_AUDIT_ACM', {
    targetDate: '2026-07-22',
  });
  console.log(`Enqueued job successfully. ID: ${job._id}`);

  await app.close();
}
bootstrap().catch(console.error);
