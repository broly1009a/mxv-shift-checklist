import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ReconciliationService } from './modules/reconciliation/reconciliation.service';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  console.log('=== KHỞI CHẠY KIỂM THỬ ĐỐI CHIẾU HARMONY ===');
  const app = await NestFactory.createApplicationContext(AppModule);
  const reconService = app.get(ReconciliationService);

  const checkEodDir =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\CHECKEOD';
  const ttttPath = path.join(checkEodDir, 'TTTT 3.xlsx');
  const psPath = path.join(checkEodDir, 'PS 1.xlsx');

  console.log(`\nReading TTTT from: ${ttttPath}`);
  console.log(`Reading PS from: ${psPath}`);

  const ttttBuffer = fs.readFileSync(ttttPath);
  const psBuffer = fs.readFileSync(psPath);

  // Call private methods by casting to any
  const service = reconService as any;

  console.log('\n--- 1. PARSING TTTT ---');
  const ttttParsed = service.parseTTTTForRecon(ttttBuffer);
  console.log(`Total TTTT parsed items: ${ttttParsed.length}`);
  const targetTttt = ttttParsed.filter((x: any) =>
    x.account.includes('041C0888668'),
  );
  console.log('Target account items in TTTT:', targetTttt);

  console.log('\n--- 2. PARSING PS ---');
  const psParsed = service.parsePSForRecon(psBuffer, new Date('2026-07-14'));
  console.log(`Total PS parsed items: ${psParsed.length}`);
  const targetPs = psParsed.filter((x: any) =>
    x.account.includes('041C0888668'),
  );
  console.log('Target account items in PS:', targetPs);

  // Run Check 4 from checkKLGD (closed trades check)
  console.log('\n--- 3. RUNNING KLGD CHECK 4 COMPARISON ---');
  const ttttData = service.parseTTTTForVolume(ttttBuffer);
  const psData = service.parsePSForVolume(psBuffer);

  const ttttSummary: Record<string, number> = {};
  ttttData.forEach((t: any) => {
    if (!t.maTKGD.toUpperCase().endsWith('A')) {
      ttttSummary[t.maTKGD] = (ttttSummary[t.maTKGD] || 0) + t.tongBan;
    }
  });

  const psSummary: Record<string, number> = {};
  psData.forEach((p: any) => {
    psSummary[p.account] = (psSummary[p.account] || 0) + p.sValue;
  });

  console.log('KLGD Closed Trade Volume for 041C0888668-L:');
  console.log('  M-System TTTT:', ttttSummary['041C0888668-L'] || 0);
  console.log('  CQG PS:', psSummary['041C0888668-L'] || 0);

  // Run Pre-EOD Closed Trades P&L Comparison
  console.log('\n--- 4. RUNNING PRE-EOD STEP 2 COMPARISON (Realized P&L) ---');
  const ttttGrouped: Record<string, number> = {};
  ttttParsed.forEach((item: any) => {
    const key = `${item.account}_${item.symbol}`;
    ttttGrouped[key] = (ttttGrouped[key] || 0) + item.position;
  });

  const psGrouped: Record<string, number> = {};
  psParsed.forEach((item: any) => {
    const key = `${item.account}_${item.symbol}`;
    psGrouped[key] = (psGrouped[key] || 0) + item.position;
  });

  const keys = Array.from(
    new Set([...Object.keys(ttttGrouped), ...Object.keys(psGrouped)]),
  );
  const targetKeys = keys.filter((k) => k.includes('041C0888668'));
  targetKeys.forEach((k) => {
    console.log(`  Key: ${k}`);
    console.log(`    M-System TTTT Realized P&L:`, ttttGrouped[k] || 0);
    console.log(`    CQG PS Realized P&L:`, psGrouped[k] || 0);
  });

  await app.close();
}

main().catch(console.error);
