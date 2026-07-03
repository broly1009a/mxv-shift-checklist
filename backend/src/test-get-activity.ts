import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DashboardService } from './modules/dashboard/dashboard.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';

async function run() {
  console.log('Booting NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const dashboardService = app.get(DashboardService);
  const userModel = app.get<any>(getModelToken(User.name));

  console.log('Fetching admin user...');
  const adminUser = await userModel.findOne({ username: 'admin' }).exec();
  if (!adminUser) {
    throw new Error('Admin user not found!');
  }

  const dateStr = '2026-07-01';
  console.log(`Calling getActivity for date ${dateStr}...`);
  console.time('getActivity');
  
  try {
    const res = await dashboardService.getActivity(dateStr, adminUser, 10);
    console.log(`Success! Result count: ${res.length}`);
    if (res.length > 0) {
      console.log('First result sample:', res[0]);
    }
  } catch (err) {
    console.error('Error during getActivity:', err);
  } finally {
    console.timeEnd('getActivity');
    await app.close();
  }
}

run().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
