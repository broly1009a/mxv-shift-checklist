import * as dotenv from 'dotenv';

dotenv.config(); // Loads .env from the current working directory (backend folder)

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // Enables communication between NextJS frontend and NestJS backend
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
// Trigger reload

