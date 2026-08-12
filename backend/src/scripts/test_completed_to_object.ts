import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BotJob } from '../schemas/bot-job.schema';

async function test() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const botJobModel = app.get<Model<BotJob>>(getModelToken(BotJob.name));

  const job = await botJobModel.findOne(
    { jobType: 'FILE_AUDIT_CQG', status: 'COMPLETED' },
    {},
    { sort: { createdAt: -1 } }
  );
  if (!job) {
    console.log('No completed job found.');
    await app.close();
    return;
  }

  console.log('Job ID:', job._id);
  console.log('Job status:', job.status);
  
  console.log('\n--- Test 1: Direct payload field ---');
  console.log('Type of job.payload:', typeof job.payload, job.payload.constructor.name);
  if (job.payload instanceof Map) {
    console.log('Using Map.get("result"):', job.payload.get('result'));
    console.log('Using Map.get("result").isWaitingFiles:', job.payload.get('result')?.isWaitingFiles);
  }

  console.log('\n--- Test 2: job.toObject() ---');
  const jobObj = job.toObject();
  console.log('Type of jobObj.payload:', typeof jobObj.payload, jobObj.payload.constructor.name);
  if (jobObj.payload instanceof Map) {
    console.log('toObject payload is still Map! result:', jobObj.payload.get('result'));
    console.log('isWaitingFiles:', jobObj.payload.get('result')?.isWaitingFiles);
  } else {
    console.log('toObject payload is plain object! result:', jobObj.payload.result);
    console.log('isWaitingFiles:', jobObj.payload.result?.isWaitingFiles);
  }

  console.log('\n--- Test 3: Object.fromEntries ---');
  try {
    const fromEntries = Object.fromEntries(job.payload as any);
    console.log('fromEntries.result:', fromEntries.result);
    console.log('fromEntries.result.isWaitingFiles:', fromEntries.result?.isWaitingFiles);
  } catch (e) {
    console.log('fromEntries failed:', e.message);
  }

  await app.close();
}

test().catch(console.error);
