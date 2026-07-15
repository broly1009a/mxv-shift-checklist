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

const mailPath = path.join(process.cwd(), 'temp', 'downloads', 'mail.txt');
const openPosPath = path.join(process.cwd(), 'temp', 'downloads', 'open_positions.xlsx');
const pendingOrdersPath = path.join(process.cwd(), 'temp', 'downloads', 'pending_orders.xlsx');

// 1. Parse email
const content = fs.readFileSync(mailPath, 'utf8');
const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
const expiringContracts: ExpiringContract[] = [];
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
  if (/^\d+$/.test(line) && i + 4 < lines.length) {
    const contractCode = lines[i + 1];
    const contractName = lines[i + 2];
    const targetDate = lines[i + 3];
    const deadline = lines[i + 4];
    if (/^[A-Z0-9]{4,10}$/.test(contractCode) && targetDate.includes('/')) {
      expiringContracts.push({ contractCode, contractName, targetDate, deadline, side: currentSide });
      i += 4;
    }
  }
}

// Filter contracts with deadline <= 15/07/2026
function parseDate(dStr: string): Date | null {
  const match = dStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
}

const today = new Date(2026, 6, 15); // 15/07/2026
const filteredContracts = expiringContracts.filter(c => {
  const d = parseDate(c.deadline);
  return d && d <= today;
});

console.log(`Contracts with deadline <= 15/07/2026:`, filteredContracts.map(c => `${c.contractCode} (${c.side}) - Deadline: ${c.deadline}`));

// 2. Load Open Positions
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

// 3. Load Pending Orders
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

// 4. Perform Match
const matchedAccounts = new Set<string>();
const matchedMembers = new Set<string>();
const results: any[] = [];

for (const c of filteredContracts) {
  // Check open positions
  for (const pos of aggregatedPos.values()) {
    if (pos.symbol.toUpperCase() === c.contractCode.toUpperCase()) {
      if (c.side === 'BUY' && pos.buyVol > 0) {
        results.push({ account: pos.account, symbol: pos.symbol, side: 'BUY', openVol: pos.buyVol, pendingVol: 0 });
        matchedAccounts.add(pos.account);
        matchedMembers.add(pos.account.substring(0, 3));
      } else if (c.side === 'SELL' && pos.sellVol > 0) {
        results.push({ account: pos.account, symbol: pos.symbol, side: 'SELL', openVol: pos.sellVol, pendingVol: 0 });
        matchedAccounts.add(pos.account);
        matchedMembers.add(pos.account.substring(0, 3));
      }
    }
  }

  // Check pending orders
  for (const ord of aggregatedOrders.values()) {
    if (ord.symbol.toUpperCase() === c.contractCode.toUpperCase()) {
      const existing = results.find(r => r.account === ord.account && r.symbol === ord.symbol);
      if (existing) {
        existing.pendingVol = ord.buyPending + ord.sellPending;
      } else {
        results.push({ account: ord.account, symbol: ord.symbol, side: c.side, openVol: 0, pendingVol: ord.buyPending + ord.sellPending });
        matchedAccounts.add(ord.account);
        matchedMembers.add(ord.account.substring(0, 3));
      }
    }
  }
}

console.log(`Unique Accounts matched: ${matchedAccounts.size}`);
console.log('List of matched Accounts:', Array.from(matchedAccounts));
console.log(`Unique Members matched: ${matchedMembers.size}`);
console.log('List of matched Members:', Array.from(matchedMembers));
