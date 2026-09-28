const fs = require('fs');
const path = require('path');
const readline = require('readline');
const xlsx = require(path.resolve(__dirname, '../backend/node_modules/xlsx'));

async function analyze() {
  const ccpFilePath = path.resolve(__dirname, '../tool-C#/fileeod/EOD.ccp.xlsx');
  const msFilePath = path.resolve(__dirname, '../tool-C#/fileeod/eod.2026-09-25.ms.csv');

  // 1. Read CCP EOD
  const wb = xlsx.readFile(ccpFilePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const ccpData = xlsx.utils.sheet_to_json(ws, { header: 1 });
  const ccpHeaders = ccpData[0];
  const ccpAccounts = new Map();

  for (let i = 1; i < ccpData.length; i++) {
    const row = ccpData[i];
    if (!row || !row[1]) continue;
    const acc = String(row[1]).trim();
    ccpAccounts.set(acc, {
      acc,
      tvkd: row[3],
      sod: Number(row[4]) || 0,
      nopRut: Number(row[5]) || 0,
      laiLoTT: Number(row[6]) || 0,
      laiLoDK: Number(row[7]) || 0,
      imr: Number(row[9]) || 0,
      kqkd: Number(row[10]) || 0,
      gtrNet: Number(row[11]) || 0,
      phiGD: Number(row[14]) || 0,
      eod: Number(row[16]) || 0,
      status: row[26]
    });
  }

  console.log('=== CCP EOD SUMMARY ===');
  console.log('Total CCP rows:', ccpData.length - 1);
  console.log('Unique CCP accounts:', ccpAccounts.size);

  // 2. Read MS EOD
  const fileStream = fs.createReadStream(msFilePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineCount = 0;
  let msHeaders = [];
  const msAccounts = new Map();
  let msNonZeroAccounts = 0;

  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) {
      msHeaders = line.split(',').map(s => s.replace(/"/g, '').trim());
      continue;
    }
    // Simple split
    const parts = line.split(',');
    const acc = (parts[6] || '').replace(/"/g, '').trim();
    const sod = parseFloat(parts[13]) || 0;
    const eod = parseFloat(parts[30]) || 0;
    const imr = parseFloat(parts[19]) || 0;
    const netMargin = parseFloat(parts[18]) || 0;
    const availMargin = parseFloat(parts[20]) || 0;
    const addMargin = parseFloat(parts[32]) || 0;
    const estimatedProfit = parseFloat(parts[15]) || 0;
    const actualProfit = parseFloat(parts[16]) || 0;
    const fee = parseFloat(parts[2]) || 0;

    if (sod !== 0 || eod !== 0 || imr !== 0 || netMargin !== 0) {
      msNonZeroAccounts++;
    }

    if (acc) {
      msAccounts.set(acc, {
        acc,
        sod,
        eod,
        imr,
        netMargin,
        availMargin,
        addMargin,
        estimatedProfit,
        actualProfit,
        fee
      });
    }
  }

  console.log('=== MS EOD SUMMARY ===');
  console.log('Total MS rows:', lineCount - 1);
  console.log('Unique MS accounts:', msAccounts.size);
  console.log('MS accounts with non-zero sod/eod/imr/netMargin:', msNonZeroAccounts);

  // 3. Cross check CCP vs MS
  let ccpInMs = 0;
  let ccpNotInMs = [];
  let matchingBalanceCount = 0;
  let balanceDiffs = [];

  for (const [acc, ccp] of ccpAccounts.entries()) {
    if (msAccounts.has(acc)) {
      ccpInMs++;
      const ms = msAccounts.get(acc);
      const diffEod = Math.abs(ccp.eod - ms.eod);
      if (diffEod < 1) {
        matchingBalanceCount++;
      } else {
        balanceDiffs.push({
          acc,
          ccpEod: ccp.eod,
          msEod: ms.eod,
          diff: ccp.eod - ms.eod,
          ccpSod: ccp.sod,
          msSod: ms.sod,
          ccpLaiLoTT: ccp.laiLoTT,
          msActualProfit: ms.actualProfit,
          ccpLaiLoDK: ccp.laiLoDK,
          msEstimatedProfit: ms.estimatedProfit
        });
      }
    } else {
      ccpNotInMs.push(acc);
    }
  }

  console.log('=== CROSS-CHECK CCP vs MS ===');
  console.log('CCP accounts found in MS:', ccpInMs, '/', ccpAccounts.size);
  console.log('CCP accounts NOT found in MS:', ccpNotInMs.length);
  if (ccpNotInMs.length > 0) {
    console.log('Sample CCP accounts NOT in MS:', ccpNotInMs.slice(0, 10));
  }
  console.log('Accounts with identical EOD balance:', matchingBalanceCount, '/', ccpInMs);
  console.log('Accounts with different EOD balance:', balanceDiffs.length);
  if (balanceDiffs.length > 0) {
    console.log('Sample balance diffs (first 5):', JSON.stringify(balanceDiffs.slice(0, 5), null, 2));
  }

  // 4. Check account code format & subaccounts (-A, etc)
  console.log('\n=== SUBACCOUNT & FORMAT CHECK ===');
  let msDashCount = 0;
  let msACount = 0;
  for (const acc of msAccounts.keys()) {
    if (acc.includes('-')) {
      msDashCount++;
      if (acc.endsWith('-A')) msACount++;
    }
  }
  let ccpDashCount = 0;
  let ccpACount = 0;
  for (const acc of ccpAccounts.keys()) {
    if (acc.includes('-')) {
      ccpDashCount++;
      if (acc.endsWith('-A')) ccpACount++;
    }
  }
  console.log(`MS total: ${msAccounts.size} | has hyphen: ${msDashCount} | has -A: ${msACount}`);
  console.log(`CCP total: ${ccpAccounts.size} | has hyphen: ${ccpDashCount} | has -A: ${ccpACount}`);

  // Test strip -A from CCP accounts to see if root account is in MS
  let ccpRootInMs = 0;
  for (const acc of ccpNotInMs) {
    const root = acc.replace(/-[A-Z0-9]+$/i, '');
    if (msAccounts.has(root)) {
      ccpRootInMs++;
    }
  }
  console.log(`CCP accounts not in MS directly (${ccpNotInMs.length}), but whose root account is in MS: ${ccpRootInMs}`);

  // Check 5 specific accounts from ccpNotInMs
  console.log('\nSample accounts not in MS and their root in MS:');
  for (let i = 0; i < Math.min(5, ccpNotInMs.length); i++) {
    const acc = ccpNotInMs[i];
    const root = acc.replace(/-[A-Z0-9]+$/i, '');
    console.log(`  CCP: ${acc} -> Root: ${root} -> In MS? ${msAccounts.has(root)}`);
    if (msAccounts.has(root)) {
      console.log(`    MS Root Data:`, msAccounts.get(root));
      console.log(`    CCP Data:`, ccpAccounts.get(acc));
    }
  }

  // 5. Output Headers Comparison & Field by Field Mapping
  console.log('\n=== FIELD MAPPING (MS vs CCP) ===');
  const mapping = [
    { field: 'Mã TKGD', ms: '[6] investorCode', ccp: '[1] Mã TKGD' },
    { field: 'Mã TVKD', ms: '[7] memberCode', ccp: '[3] Mã TVKD' },
    { field: 'Tên KH/TK', ms: '[12] investorName', ccp: '[2] Tên TKGD' },
    { field: 'Số dư đầu ngày', ms: '[13] sodBalance', ccp: '[4] Số dư đầu ngày' },
    { field: 'Nộp rút trong ngày', ms: '[14] changedAmount', ccp: '[5] Nộp rút trong ngày' },
    { field: 'Lãi lỗ thực tế (VND)', ms: '[16] actualProfitVND', ccp: '[6] Lãi lỗ thực tế (VND)' },
    { field: 'Lãi lỗ dự kiến (VND)', ms: '[15] estimatedProfitVND', ccp: '[7] Lãi lỗ dự kiến (VND)' },
    { field: 'KQ ban đầu yêu cầu (IMR)', ms: '[19] initialRequiredMargin', ccp: '[9] KQ ban đầu yêu cầu' },
    { field: 'Ký quỹ khả dụng', ms: '[20] availableMargin', ccp: '[10] Ký quỹ khả dụng' },
    { field: 'Giá trị ròng ký quỹ', ms: '[18] netMargin', ccp: '[11] Giá trị ròng ký quỹ' },
    { field: 'Lãi lỗ thực tế Option', ms: '[23] optionsActualProfitVND', ccp: '[12] Lãi lỗ thực tế Option' },
    { field: 'Lãi lỗ dự kiến Option', ms: '[22] optionsEstimatedProfitVND', ccp: '[13] Lãi lỗ dự kiến Option' },
    { field: 'Phí giao dịch', ms: '[2] transactionFee', ccp: '[14] Phí giao dịch' },
    { field: 'Phí quyền chọn', ms: '[24] premiumFeeVND', ccp: '[15] Phí quyền chọn' },
    { field: 'Số dư cuối ngày', ms: '[30] eodBalance', ccp: '[16] Số dư cuối ngày' },
    { field: 'MVO (VND)', ms: '[25] mvoVND', ccp: '[17] MVO (VND)' },
    { field: 'Mức bổ sung ký quỹ', ms: '[32] additionalMargin', ccp: '[18] Mức bổ sung ký quỹ' },
    { field: 'Tỷ lệ ký quỹ', ms: '[33] marginRatio', ccp: '[19] Tỷ lệ ký quỹ' },
    { field: 'Ký quỹ MXV', ms: '[34] initialRequiredMarginMXV', ccp: '[22] Ký quỹ giao nhận / N/A' },
  ];
  console.table(mapping);
}

analyze().catch(console.error);
