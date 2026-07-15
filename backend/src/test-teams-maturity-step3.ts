import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

interface ExpiringContract {
  contractCode: string;
  contractName: string;
  targetDate: string;
  deadline: string;
  side: 'BUY' | 'SELL';
}

interface MatchResult {
  account: string;
  contractCode: string;
  contractName: string;
  side: 'BUY' | 'SELL';
  openVolume: number;
  pendingVolume: number;
  pendingSide: string;
  deadline: string;
}

interface GroupedMatch {
  account: string;
  contractCode: string;
  contractName: string;
  openSide: 'BUY' | 'SELL' | 'NONE';
  openVolume: number;
  pendingSide: 'BUY' | 'SELL' | 'BOTH' | 'NONE';
  pendingVolume: number;
  deadline: string;
}

function parseEmailText(filePath: string): ExpiringContract[] {
  console.log(`Parsing email text from: ${filePath}`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Email file not found at: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);

  const contracts: ExpiringContract[] = [];
  let currentSide: 'BUY' | 'SELL' = 'BUY';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('Đối với Vị thế mở mua') || line.includes('Ngày thông báo đầu tiên')) {
      currentSide = 'BUY';
      continue;
    }
    if (line.includes('Đối với Vị thế mở bán') || line.includes('Ngày giao dịch cuối cùng')) {
      currentSide = 'SELL';
      continue;
    }

    // A contract row starts with STT (digit) followed by contract code
    if (/^\d+$/.test(line) && i + 4 < lines.length) {
      const contractCode = lines[i + 1];
      const contractName = lines[i + 2];
      const targetDate = lines[i + 3];
      const deadline = lines[i + 4];

      if (/^[A-Z0-9]{4,10}$/.test(contractCode) && targetDate.includes('/')) {
        contracts.push({
          contractCode,
          contractName,
          targetDate,
          deadline,
          side: currentSide
        });
        i += 4;
      }
    }
  }

  console.log(`Total contracts parsed from email: ${contracts.length}`);
  return contracts;
}

function runStep3Test() {
  const mailPath = path.join(process.cwd(), 'temp', 'downloads', 'mail.txt');
  const openPosPath = path.join(process.cwd(), 'temp', 'downloads', 'open_positions.xlsx');
  const pendingOrdersPath = path.join(process.cwd(), 'temp', 'downloads', 'pending_orders.xlsx');

  // Determine target date (default to today, July 15, 2026 for this run context)
  let targetDateStr = '15/07/2026';
  const dateArg = process.argv.find(arg => arg.startsWith('--date='));
  if (dateArg) {
    targetDateStr = dateArg.split('=')[1];
  } else {
    // If no argument, detect today's date dynamically
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    targetDateStr = `${day}/${month}/${year}`;
  }

  console.log(`Target deadline date: ${targetDateStr}`);

  const allContracts = parseEmailText(mailPath);
  
  // Filter contracts by target date
  const expiringContracts = allContracts.filter(c => c.deadline.includes(targetDateStr));
  console.log(`Filtered contracts expiring on ${targetDateStr} (${expiringContracts.length}):`);
  expiringContracts.forEach(c => console.log(`  - ${c.contractCode} (${c.side}) - Deadline: ${c.deadline}`));

  if (expiringContracts.length === 0) {
    console.log(`No contracts expiring on ${targetDateStr}. Exiting.`);
    return;
  }

  // 1. Load and aggregate Open Positions
  console.log(`Loading Open Positions from: ${openPosPath}`);
  const openPosWorkbook = XLSX.readFile(openPosPath);
  const openPosSheet = openPosWorkbook.Sheets[openPosWorkbook.SheetNames[0]];
  const openPosRows = XLSX.utils.sheet_to_json(openPosSheet, { header: 1 }) as any[][];
  const openPosHeader = openPosRows[0].map(h => String(h || '').trim());
  const accountIdx = openPosHeader.indexOf('Mã TKGD');
  const symbolIdx = openPosHeader.indexOf('Mã HĐ');
  const klMuaIdx = openPosHeader.indexOf('KL Mua');
  const klBanIdx = openPosHeader.indexOf('KL Bán');

  const aggregatedPos = new Map<string, { account: string, symbol: string, buyVol: number, sellVol: number }>();
  for (let i = 1; i < openPosRows.length; i++) {
    const row = openPosRows[i];
    if (!row || row.length === 0) continue;
    const account = String(row[accountIdx] || '').trim();
    const symbol = String(row[symbolIdx] || '').trim();
    const klMua = parseFloat(row[klMuaIdx]) || 0;
    const klBan = parseFloat(row[klBanIdx]) || 0;
    if (!account || !symbol) continue;

    const key = `${account}_${symbol}`;
    const existing = aggregatedPos.get(key) || { account, symbol, buyVol: 0, sellVol: 0 };
    existing.buyVol += klMua;
    existing.sellVol += klBan;
    aggregatedPos.set(key, existing);
  }

  // 2. Load and aggregate Pending Orders
  console.log(`Loading Pending Orders from: ${pendingOrdersPath}`);
  const pendingWorkbook = XLSX.readFile(pendingOrdersPath);
  const pendingSheet = pendingWorkbook.Sheets[pendingWorkbook.SheetNames[0]];
  const pendingRows = XLSX.utils.sheet_to_json(pendingSheet, { header: 1 }) as any[][];
  const pendingHeader = pendingRows[0].map(h => String(h || '').trim());
  const pAccountIdx = pendingHeader.indexOf('Mã TKGD');
  const pSymbolIdx = pendingHeader.indexOf('Mã HĐ');
  const pSideIdx = pendingHeader.indexOf('Chiều mua bán');
  const pKlDatIdx = pendingHeader.indexOf('KL đặt lệnh');
  const pKlKhopIdx = pendingHeader.indexOf('KL khớp');
  const pStatusIdx = pendingHeader.indexOf('Trạng thái');

  const aggregatedOrders = new Map<string, { account: string, symbol: string, buyPending: number, sellPending: number }>();
  for (let i = 1; i < pendingRows.length; i++) {
    const row = pendingRows[i];
    if (!row || row.length === 0) continue;
    const account = String(row[pAccountIdx] || '').trim();
    const symbol = String(row[pSymbolIdx] || '').trim();
    const side = String(row[pSideIdx] || '').trim();
    const klDat = parseFloat(row[pKlDatIdx]) || 0;
    const klKhop = parseFloat(row[pKlKhopIdx]) || 0;
    const status = String(row[pStatusIdx] || '').trim();
    if (!account || !symbol || status !== 'Đang chờ khớp') continue;

    const remaining = klDat - klKhop;
    if (remaining <= 0) continue;

    const key = `${account}_${symbol}`;
    const existing = aggregatedOrders.get(key) || { account, symbol, buyPending: 0, sellPending: 0 };
    if (side === 'BUY') {
      existing.buyPending += remaining;
    } else if (side === 'SELL') {
      existing.sellPending += remaining;
    }
    aggregatedOrders.set(key, existing);
  }

  // 3. Match contracts with aggregated data (applying side-specific rules)
  const matchedResults: MatchResult[] = [];
  const matchedAccounts = new Set<string>();

  for (const c of expiringContracts) {
    // Match open positions
    for (const pos of aggregatedPos.values()) {
      if (pos.symbol.toUpperCase() === c.contractCode.toUpperCase()) {
        if (c.side === 'BUY' && pos.buyVol > 0) {
          matchedResults.push({
            account: pos.account,
            contractCode: c.contractCode,
            contractName: c.contractName,
            side: c.side,
            openVolume: pos.buyVol,
            pendingVolume: 0,
            pendingSide: '',
            deadline: c.deadline
          });
          matchedAccounts.add(pos.account);
        } else if (c.side === 'SELL' && pos.sellVol > 0) {
          matchedResults.push({
            account: pos.account,
            contractCode: c.contractCode,
            contractName: c.contractName,
            side: c.side,
            openVolume: pos.sellVol,
            pendingVolume: 0,
            pendingSide: '',
            deadline: c.deadline
          });
          matchedAccounts.add(pos.account);
        }
      }
    }

    // Match pending orders (applying side-specific rules)
    for (const ord of aggregatedOrders.values()) {
      if (ord.symbol.toUpperCase() === c.contractCode.toUpperCase()) {
        let pendingVol = 0;
        let pendingSide = '';

        if (c.side === 'BUY' && ord.buyPending > 0) {
          pendingVol = ord.buyPending;
          pendingSide = 'BUY';
        } else if (c.side === 'SELL' && ord.sellPending > 0) {
          pendingVol = ord.sellPending;
          pendingSide = 'SELL';
        }

        if (pendingVol > 0) {
          const existing = matchedResults.find(r => r.account === ord.account && r.contractCode === c.contractCode && r.side === c.side);
          if (existing) {
            existing.pendingVolume = pendingVol;
            existing.pendingSide = pendingSide;
          } else {
            matchedResults.push({
              account: ord.account,
              contractCode: c.contractCode,
              contractName: c.contractName,
              side: c.side,
              openVolume: 0,
              pendingVolume: pendingVol,
              pendingSide: pendingSide,
              deadline: c.deadline
            });
            matchedAccounts.add(ord.account);
          }
        }
      }
    }
  }

  // Group by (account, contractCode) to combine BUY and SELL matches of the same contract
  const groupedMap = new Map<string, GroupedMatch>();
  for (const r of matchedResults) {
    const key = `${r.account}_${r.contractCode}`;
    const existing = groupedMap.get(key);
    if (existing) {
      if (r.openVolume > 0) {
        existing.openVolume = r.openVolume;
        existing.openSide = r.side;
      }
      if (r.pendingVolume > 0) {
        if (existing.pendingVolume > 0) {
          existing.pendingVolume += r.pendingVolume;
          existing.pendingSide = 'BOTH';
        } else {
          existing.pendingVolume = r.pendingVolume;
          existing.pendingSide = r.pendingSide as any;
        }
      }
    } else {
      groupedMap.set(key, {
        account: r.account,
        contractCode: r.contractCode,
        contractName: r.contractName,
        openSide: r.openVolume > 0 ? r.side : 'NONE',
        openVolume: r.openVolume,
        pendingSide: r.pendingVolume > 0 ? (r.pendingSide as any) : 'NONE',
        pendingVolume: r.pendingVolume,
        deadline: r.deadline
      });
    }
  }

  // Count total matching lots
  let totalOpenLots = 0;
  let totalPendingLots = 0;
  for (const g of groupedMap.values()) {
    totalOpenLots += g.openVolume;
    totalPendingLots += g.pendingVolume;
  }
  const totalLots = totalOpenLots + totalPendingLots;
  console.log(`\nReconciliation Summary:`);
  console.log(`  - Total Open Position Lots: ${totalOpenLots}`);
  console.log(`  - Total Pending Order Lots: ${totalPendingLots}`);
  console.log(`  - Total Combined Lots matched: ${totalLots}`);

  // Group grouped results by Member Code (first 3 chars of account)
  const memberGroup = new Map<string, GroupedMatch[]>();
  for (const g of groupedMap.values()) {
    const memberCode = g.account.substring(0, 3);
    const list = memberGroup.get(memberCode) || [];
    list.push(g);
    memberGroup.set(memberCode, list);
  }

  console.log(`Matched accounts from ${memberGroup.size} members (Total unique accounts: ${matchedAccounts.size}).`);

  // Build Teams Card payloads
  const outputFilePath = path.join(process.cwd(), 'temp', 'downloads', 'teams_adaptive_cards.txt');
  let outputText = `====================================================\n`;
  outputText += `TEAMS ADAPTIVE CARDS REPORT FOR MATURITY RECONCILIATION\n`;
  outputText += `Target Date: ${targetDateStr}\n`;
  outputText += `Generated At: ${new Date().toLocaleString()}\n`;
  outputText += `Total Lots Matched: ${totalLots}\n`;
  outputText += `====================================================\n\n`;

  const noticeDate = '06/07/2026';

  for (const [memberCode, items] of memberGroup.entries()) {
    const facts: any[] = [];
    items.forEach((item, idx) => {
      if (idx > 0) {
        facts.push({ title: '---', value: '----------------------------------------' });
      }
      const posDesc = item.openVolume > 0
        ? `${item.openSide === 'BUY' ? 'MUA' : 'BÁN'} (KL: ${item.openVolume} lot)`
        : 'Không';
      
      let pendingDesc = 'Không';
      if (item.pendingVolume > 0) {
        if (item.pendingSide === 'BOTH') {
          pendingDesc = `MUA/BÁN (KL: ${item.pendingVolume} lot)`;
        } else {
          pendingDesc = `${item.pendingSide === 'BUY' ? 'MUA' : 'BÁN'} (KL: ${item.pendingVolume} lot)`;
        }
      }

      facts.push(
        { title: 'Tài khoản', value: item.account },
        { title: 'Hợp đồng', value: `${item.contractCode} (${item.contractName})` },
        { title: 'Vị thế mở', value: posDesc },
        { title: 'Lệnh chờ', value: pendingDesc },
        { title: 'Hạn tất toán', value: item.deadline }
      );
    });

    const card = {
      type: "AdaptiveCard",
      body: [
        {
          type: "TextBlock",
          size: "large",
          weight: "Bolder",
          text: `🚨 CẢNH BÁO ĐÁO HẠN HỢP ĐỒNG - THÀNH VIÊN ${memberCode}`,
          color: "Attention"
        },
        {
          type: "TextBlock",
          text: `Chào bộ phận QLGD và Thành viên **${memberCode}**,\n` +
                `Theo Thông báo thời hạn tất toán hợp đồng được MXV gửi tới TVKD ngày **${noticeDate}**, ` +
                `vui lòng kiểm tra và thực hiện tất toán vị thế mở, hủy lệnh chờ dẫn tới mở mới vị thế đến hạn để tránh vi phạm quy định.`,
          wrap: true
        },
        {
          type: "FactSet",
          facts: facts
        },
        {
          type: "TextBlock",
          text: "⚠️ **Lưu ý:** Tất cả các vị thế mở TVKD thực hiện đóng sau thời gian phải tất toán 30 phút sẽ vi phạm quy định về việc “Đóng vị thế mở khi đến ngày đáo hạn của Hợp đồng Kỳ hạn tiêu chuẩn hàng hoá”.",
          wrap: true,
          weight: "Bolder",
          color: "Warning"
        }
      ],
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      version: "1.2"
    };

    outputText += `----------------------------------------------------\n`;
    outputText += `MEMBER: ${memberCode} (${items.length} unique contract positions)\n`;
    outputText += `----------------------------------------------------\n`;
    outputText += JSON.stringify(card, null, 2);
    outputText += `\n\n`;
  }

  fs.writeFileSync(outputFilePath, outputText, 'utf8');
  console.log(`✅ SUCCESS: Clean, grouped Teams Adaptive Cards report saved to: ${outputFilePath}`);

  // Generate the manual text messages for copy-pasting
  const manualMessagesPath = path.join(process.cwd(), 'temp', 'downloads', 'teams_manual_messages.txt');
  let manualText = `====================================================\n`;
  manualText += `DANH SÁCH TEMPLATE TIN NHẮN THỦ CÔNG GỬI THÀNH VIÊN (QLGD)\n`;
  manualText += `Target Date: ${targetDateStr}\n`;
  manualText += `Generated At: ${new Date().toLocaleString()}\n`;
  manualText += `====================================================\n\n`;

  for (const [memberCode, items] of memberGroup.entries()) {
    manualText += `====================================================\n`;
    manualText += `THÀNH VIÊN: ${memberCode}\n`;
    manualText += `====================================================\n\n`;

    items.forEach((item) => {
      let targetDetail = '';
      if (item.openVolume > 0 && item.pendingVolume > 0) {
        const oSide = item.openSide === 'BUY' ? 'MUA' : 'BÁN';
        const pSide = item.pendingSide === 'BOTH' ? 'MUA/BÁN' : (item.pendingSide === 'BUY' ? 'MUA' : 'BÁN');
        targetDetail = `vị thế mở ${oSide} (KL: ${item.openVolume} lot) và lệnh chờ ${pSide} (KL: ${item.pendingVolume} lot)`;
      } else if (item.openVolume > 0) {
        const oSide = item.openSide === 'BUY' ? 'MUA' : 'BÁN';
        targetDetail = `vị thế mở ${oSide} (KL: ${item.openVolume} lot)`;
      } else if (item.pendingVolume > 0) {
        const pSide = item.pendingSide === 'BOTH' ? 'MUA/BÁN' : (item.pendingSide === 'BUY' ? 'MUA' : 'BÁN');
        targetDetail = `lệnh chờ ${pSide} (KL: ${item.pendingVolume} lot)`;
      }

      const msg = `Theo Thông báo thời hạn tất toán hợp đồng được MXV gửi tới TVKD ngày ${noticeDate}, thời hạn tất toán ${targetDetail} hợp đồng ${item.contractCode} là ${item.deadline}.\n` +
                  `TVKD lưu ý kiểm tra lại thông báo, thực hiện tất toán vị thế mở, huỷ lệnh chờ dẫn tới mở mới vị thế đến hạn, tránh vi phạm quy định của MXV về việc Đóng vị thế mở khi đến ngày đáo hạn của hợp đồng.`;
      
      manualText += `Tài khoản: ${item.account}\n`;
      manualText += `${msg}\n`;
      manualText += `----------------------------------------------------\n\n`;
    });
  }

  fs.writeFileSync(manualMessagesPath, manualText, 'utf8');
  console.log(`✅ SUCCESS: Manual copy-paste messages report saved to: ${manualMessagesPath}`);
}

runStep3Test();
