import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MarginChangeRequestsService } from './modules/margin-change-requests/margin-change-requests.service';

async function testScanDecision() {
  console.log('--- KHỞI ĐỘNG CONTEXT NESTJS ---');
  const appContext = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const service = appContext.get(MarginChangeRequestsService);
    
    // Mock user matching a valid ObjectId format and role with MARGIN_CHANGE access (e.g. ADMIN)
    const mockUser = {
      _id: '64b1f63e7284b1625cc7871b',
      id: '64b1f63e7284b1625cc7871b',
      username: 'admin',
      role: 'ADMIN',
    };

    console.log('--- BẮT ĐẦU CHẠY THỬ QUÉT QUYẾT ĐỊNH KÝ QUỸ ---');
    const result = await service.scanDecisionDocument(mockUser);
    
    console.log('✅ KẾT QUẢ QUÉT THÀNH CÔNG:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error: any) {
    console.error('❌ LỖI XẢY RA KHI TEST:');
    console.error(error.stack || error.message || error);
  } finally {
    console.log('--- ĐÓNG CONTEXT ---');
    await appContext.close();
    process.exit(0);
  }
}

testScanDecision();
