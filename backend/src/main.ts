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
      [
        'RoutesResolver',
        'RouterExplorer',
        'InstanceLoader',
        'NestFactory',
        'NestApplication',
      ].includes(context)
    ) {
      return;
    }
    super.log(message, context);
  }
}

import { json, urlencoded } from 'express';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new CompactConsoleLogger(),
  });
  // Fail-Fast: CORS chỉ cho phép đúng origin giao diện (FRONTEND_URL), không mở '*' và không có giá trị mặc định.
  const frontendOrigin = (process.env.FRONTEND_URL || '').trim();
  if (!frontendOrigin) {
    throw new Error(
      'FRONTEND_URL chưa được cấu hình trong .env. Từ chối khởi động để tránh mở CORS toàn cục.',
    );
  }
  app.use(helmet());
  app.enableCors({ origin: new URL(frontendOrigin).origin, credentials: true });
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
// Trigger reload
