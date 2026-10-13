import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getModelToken } from '@nestjs/mongoose';
import { BotJob } from './schemas/bot-job.schema';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const botJobModel = app.get<Model<BotJob>>(getModelToken('BotJob'));

  const jobs = await botJobModel
    .find({})
    .sort({ createdAt: -1 })
    .limit(5)
    .exec();
  console.log('\n--- LATEST 5 BOT JOBS IN ATLAS ---');
  for (const job of jobs) {
    console.log(`\nID: ${job._id}`);
    console.log(`Type: ${job.jobType}`);
    console.log(`Status: ${job.status}`);
    console.log(`Payload: ${JSON.stringify(job.payload)}`);
    console.log('Logs:');
    for (const logLine of job.logs) {
      console.log(`  ${logLine}`);
    }
  }

  await app.close();
}
bootstrap().catch(console.error);
