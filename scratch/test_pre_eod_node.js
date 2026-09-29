const fs = require('fs');
const path = require('path');

// Require PreEodReconService from dist
const { PreEodReconService } = require('../backend/dist/modules/reconciliation/services/pre-eod-recon.service');

async function main() {
  const baseDir = "C:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Pictures\\Dữ liệu chuẩn ngày 25";
  const dsgdPath = path.join(baseDir, "25.09 MS", "DSGD.xlsx");
  const ttttPath = path.join(baseDir, "25.09 MS", "TTTT.xlsx");
  const acmPath = path.join(baseDir, "25.09 ACM", "EOD FO trades_PT Straits Financial Indonesia - 10017890000_25092026.csv");
  const frPath = path.join(baseDir, "25.09 CQG", "FR.xlsx");
  const psPath = path.join(baseDir, "25.09 CQG", "PS.xlsx");

  const files = {
    dsgd: fs.readFileSync(dsgdPath),
    acmTrades: fs.readFileSync(acmPath),
    cqgFr: fs.readFileSync(frPath),
    tttt: fs.readFileSync(ttttPath),
    cqgPs: fs.readFileSync(psPath),
  };

  const acmTradesName = path.basename(acmPath);
  const tradingDate = new Date('2026-09-28T00:00:00Z');

  const service = new PreEodReconService(null, null, null);

  console.log("================================================================================");
  console.log("CHAY DOI CHIEU CHECK PRE-EOD BANG NODE.JS / NESTJS VOI DU LIEU NGAY 25/09/2026");
  console.log("================================================================================");
  console.log("Dang thuc thi checkPreEOD bang ma Node.js...");

  const startTime = Date.now();
  const res = await service.checkPreEOD(files, acmTradesName, tradingDate, []);
  const duration = Date.now() - startTime;

  console.log();
  console.log("================================================================================");
  console.log(`KET QUA DOI CHIEU TU MA NODE.JS (Thoi gian: ${duration} ms)`);
  console.log("================================================================================");
  console.log(`• Passed Status : ${res.passed}`);

  console.log();
  console.log("--- 1. TONG HOP KHOI LUONG GIAO DICH (Node.js) ---");
  console.log(" [ACM / Tu Doanh]");
  console.log(`   - M-System MS (duoi A) : ${res.totals.totalACM_MS.toLocaleString()} lot`);
  console.log(`   - ACM Straits (file CSV): ${res.totals.totalACM_Straits.toLocaleString()} lot`);
  console.log(`   - Chenh lech ACM        : ${res.totals.differACM.toLocaleString()} lot`);

  console.log(" [CQG / Khach Hang Thuong]");
  console.log(`   - M-System MS (khac A) : ${res.totals.totalCQG_MS.toLocaleString()} lot`);
  console.log(`   - CQG FR (tru ZWAZCE)  : ${res.totals.totalCQG_FR.toLocaleString()} lot`);
  console.log(`   - Chenh lech CQG        : ${res.totals.differCQG.toLocaleString()} lot`);

  console.log();
  console.log("--- 2. CHI TIET LENH LECH KHOP LENH (Node.js) ---");
  console.log(`• So luong lenh lech: ${res.mismatchedTrades.length}`);
  if (res.mismatchedTrades.length > 0) {
    res.mismatchedTrades.slice(0, 10).forEach(t => {
      console.log(`  - [${t.source}] TK: ${t.maTKGD}, HD: ${t.maHD}, Gia: ${t.giaKhop}, Qty: ${t.klGiaoDich} : ${t.reason}`);
    });
    if (res.mismatchedTrades.length > 10) {
      console.log(`  ... va con ${res.mismatchedTrades.length - 10} lenh lech khac`);
    }
  } else {
    console.log("OK! Khong co lenh lech nao giua MS va CQG!");
  }

  console.log();
  console.log("--- 3. CHI TIET LECH VI THE TAT TOAN NET (Node.js) ---");
  console.log(`• So vi the net lech: ${res.mismatchedPositions.length}`);
  if (res.mismatchedPositions.length > 0) {
    res.mismatchedPositions.slice(0, 10).forEach(p => {
      console.log(`  - TK: ${p.account} | HD: ${p.symbol} | MS: ${p.msPosition} | CQG: ${p.cqgPosition} | Lech: ${p.differ}`);
    });
    if (res.mismatchedPositions.length > 10) {
      console.log(`  ... va con ${res.mismatchedPositions.length - 10} vi the net lech khac`);
    }
  } else {
    console.log("OK! Khong co lech vi the net!");
  }

  console.log();
  console.log("================================================================================");
  console.log("HOAN TAT KIEM TRA NODE.JS");
  console.log("================================================================================");
}

main().catch(console.error);
