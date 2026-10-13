import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const model = app.get<Model<User>>(getModelToken('User'));

  const users = await model.find({}).exec();
  console.log('\n--- SYSTEM USERS ---');
  for (const user of users) {
    console.log(`Username: "${user.username}", FullName: "${user.fullName}", ID: "${user._id}"`);
  }

  await app.close();
}
bootstrap().catch(console.error);
