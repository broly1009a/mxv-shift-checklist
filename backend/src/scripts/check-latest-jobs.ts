import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';

async function checkJobs() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const botJobModel = app.get(getModelToken('BotJob'));
  const latestJobs = await botJobModel.find({}).sort({ createdAt: -1 }).limit(5).exec();
  console.log('=== LATEST 5 BOT JOBS ===');
  for (const job of latestJobs) {
    console.log(`\nJob ID: ${job._id} | Type: ${job.jobType} | Status: ${job.status}`);
    console.log(`Attempts: ${job.attempts}/${job.maxAttempts}`);
    console.log('Payload:', JSON.stringify(job.payload));
    console.log('Logs:\n' + job.logs.join('\n'));
  }
  await app.close();
}

checkJobs().catch(console.error);
