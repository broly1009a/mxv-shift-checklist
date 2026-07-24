import * as dotenv from 'dotenv';

dotenv.config(); // Loads .env from the current working directory (backend folder)

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsoleLogger } from '@nestjs/common';

class CompactConsoleLogger extends ConsoleLogger {
  log(message: any, context?: string) {
    // Ẩn bớt các log khởi tạo router/explorer dài dòng của NestJS
    if (
      context &&
      ['RoutesResolver', 'RouterExplorer', 'InstanceLoader', 'NestFactory', 'NestApplication'].includes(context)
    ) {
      return;
    }
    super.log(message, context);
  }
}

import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new CompactConsoleLogger(),
  });
  app.enableCors(); // Enables communication between NextJS frontend and NestJS backend
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
// Trigger reload

