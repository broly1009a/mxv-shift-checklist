const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../../dist/app.module');
const { ReconciliationService } = require('../../dist/modules/reconciliation/reconciliation.service');

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const service = app.get(ReconciliationService);

  const targetDate = new Date('2026-07-23');
  console.log('Running runAutoCheckPreEOD for 2026-07-23...');
  const result = await service.runAutoCheckPreEOD(targetDate);
  console.log('Result totals:', JSON.stringify(result.totals, null, 2));
  console.log('Passed:', result.passed);
  console.log('Message:', result.message);
  console.log('Mismatched trades count:', result.mismatchedTrades ? result.mismatchedTrades.length : 0);
  console.log('Mismatched TTM/Positions count:', result.mismatchedPositions ? result.mismatchedPositions.length : 0);
  console.log('Mismatched TTTT count:', result.mismatchedTTTT ? result.mismatchedTTTT.length : 0);
  await app.close();
}

main().catch(console.error);
