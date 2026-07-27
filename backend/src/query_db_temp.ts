import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BotJob } from './schemas/bot-job.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const botJobModel = app.get<Model<BotJob>>(getModelToken('BotJob'));

  const jobs = await botJobModel
    .find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .exec();

  console.log('\n--- LATEST 5 BOT JOBS ---');
  for (const job of jobs) {
    console.log(`\nID: ${job._id}`);
    console.log(`Type: ${job.jobType}`);
    console.log(`Status: ${job.status}`);
    console.log(`Payload:`, JSON.stringify(job.payload));
    console.log(`Logs:`);
    if (job.logs && job.logs.length > 0) {
      job.logs.forEach((l: string) => console.log(`  ${l}`));
    } else {
      console.log('  (No logs)');
    }
  }

  await app.close();
}
bootstrap().catch(console.error);
