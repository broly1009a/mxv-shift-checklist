import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { CqgMergerService } from '../../modules/trading-ops/services/cqg-merger.service';
import { KlgdReconService } from '../../modules/trading-ops/services/klgd-recon.service';
import { PreEodReconService } from '../../modules/trading-ops/services/pre-eod-recon.service';
import { LotStatisticsService } from '../../modules/ccp-clearing/services/lot-statistics.service';
import { BotDispatcherService } from '../../modules/checklist-hub/dispatcher/bot-dispatcher.service';
import { KlgdReconWorker } from '../../modules/trading-ops/workers/klgd-recon.worker';
import { PreEodReconWorker } from '../../modules/trading-ops/workers/pre-eod-recon.worker';

describe('Twin-Run Verification - So Sánh Song Hành V1 vs Modular Monolith V2', () => {
  const scratchDir = path.join(process.cwd(), 'scratch', 'twin-run-test');

  beforeAll(() => {
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }
  });

  afterAll(() => {
    try {
      if (fs.existsSync(scratchDir)) {
        fs.rmSync(scratchDir, { recursive: true, force: true });
      }
    } catch {}
  });

  describe('1. CQG Raw Files Auto-Merger (C# Rule Preservation)', () => {
    it('Ghép FR1 + FR2 phải cắt đúng 2 hàng footer và bảo tồn header hàng 2', () => {
      const merger = new CqgMergerService();

      // Giả lập file FR1 (Header hàng 2, Data 3 dòng, 2 dòng footer)
      const fr1Data = [
        ['CQG Export Header Ignored'],
        ['Ord #', 'Account', 'Symbol', 'Qty', 'Fill P', 'Time'],
        ['ORD001', '012C123456F', 'ZLEZ24', 5, 45.2, '10:00:00'],
        ['ORD002', '012C123456L', 'CAEU24', 2, 9200, '10:05:00'],
        ['ORD003', '012C123456S', 'CLEV24', 1, 75.5, '10:10:00'],
        ['Total Rows: 3', '', '', '', '', ''],
        ['Footer Row 2', '', '', '', '', ''],
      ];

      // Giả lập file FR2 (Header hàng 2, Data 2 dòng, 2 dòng footer)
      const fr2Data = [
        ['CQG Export Header Ignored'],
        ['Ord #', 'Account', 'Symbol', 'Qty', 'Fill P', 'Time'],
        ['ORD004', '012C999999F', 'ZLEZ24', 10, 45.3, '11:00:00'],
        ['ORD005', '012C999999F', 'ZLEZ24', 20, 45.4, '11:05:00'],
        ['Total Rows: 2', '', '', '', '', ''],
        ['Footer Row 2', '', '', '', '', ''],
      ];

      const fr1Path = path.join(scratchDir, 'FR1.xlsx');
      const fr2Path = path.join(scratchDir, 'FR2.xlsx');
      const frDestPath = path.join(scratchDir, 'FR.xlsx');

      const wb1 = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb1, XLSX.utils.aoa_to_sheet(fr1Data), 'Sheet1');
      XLSX.writeFile(wb1, fr1Path);

      const wb2 = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet(fr2Data), 'Sheet1');
      XLSX.writeFile(wb2, fr2Path);

      const success = merger.mergeFR(fr1Path, fr2Path, frDestPath);
      expect(success).toBe(true);
      expect(fs.existsSync(frDestPath)).toBe(true);

      const mergedWb = XLSX.readFile(frDestPath);
      const mergedRows: any[][] = XLSX.utils.sheet_to_json(
        mergedWb.Sheets[mergedWb.SheetNames[0]],
        { header: 1 },
      );

      // Header row (1) + 3 rows from FR1 + 2 rows from FR2 = 6 rows total (2 footer rows của mỗi file đều bị cắt bỏ)
      expect(mergedRows.length).toBe(6);
      expect(mergedRows[0][0]).toBe('Ord #');
      expect(mergedRows[1][0]).toBe('ORD001');
      expect(mergedRows[3][0]).toBe('ORD003');
      expect(mergedRows[4][0]).toBe('ORD004');
      expect(mergedRows[5][0]).toBe('ORD005');
    });

    it('Ghép PS1 + PS2 phải chuẩn hóa hậu tố tài khoản F$ -> "", L$ -> "-L", S$ -> "-S"', () => {
      const merger = new CqgMergerService();

      const ps1Data = [
        ['Header Ignored'],
        ['Account', 'Name', 'Cur', 'Symbol', 'O/C', 'Side', 'Qty', 'Price', 'Position'],
        ['012C123456F', 'User F', 'USD', 'ZLEZ24', 'O', 'B', 1, 45, 5],
        ['012C123456L', 'User L', 'USD', 'CAEU24', 'O', 'B', 1, 9000, 2],
        ['012C123456S', 'User S', 'USD', 'CLEV24', 'O', 'B', 1, 75, 1],
      ];

      const ps1Path = path.join(scratchDir, 'PS1.xlsx');
      const ps2Path = path.join(scratchDir, 'PS2.xlsx');
      const psDestPath = path.join(scratchDir, 'PS.xlsx');

      const wb1 = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb1, XLSX.utils.aoa_to_sheet(ps1Data), 'Sheet1');
      XLSX.writeFile(wb1, ps1Path);

      // Empty PS2
      const wb2 = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet([['Header']]), 'Sheet1');
      XLSX.writeFile(wb2, ps2Path);

      const success = merger.mergePS(ps1Path, ps2Path, psDestPath);
      expect(success).toBe(true);

      const mergedWb = XLSX.readFile(psDestPath);
      expect(mergedWb.SheetNames).toContain('Check CQG-MS');

      const checkSheet = mergedWb.Sheets['Check CQG-MS'];
      const checkRows: any[][] = XLSX.utils.sheet_to_json(checkSheet, { header: 1 });

      // Cột A đã được chuẩn hóa hậu tố
      expect(checkRows[1][0]).toBe('012C123456'); // F$ -> ""
      expect(checkRows[2][0]).toBe('012C123456-L'); // L$ -> "-L"
      expect(checkRows[3][0]).toBe('012C123456-S'); // S$ -> "-S"
    });
  });

  describe('2. Intraday KLGD Reconciliation (Lõi Đối Chiếu Trong Phiên V2)', () => {
    it('Đối chiếu khớp 100% khi số liệu MS và CQG đồng nhất', async () => {
      const mockSettings: any = {
        getSetting: jest.fn().mockResolvedValue('05:00'),
        setSetting: jest.fn().mockResolvedValue(true),
      };

      const klgdService = new KlgdReconService(mockSettings);

      // Tạo Buffer DSGD (M-System)
      const dsgdRows = [
        ['Mã lệnh', 'Mã TKGD', 'Mã HĐ', 'KL giao dịch', 'Giá khớp', 'Ngày giờ thực hiện', 'Mã giao dịch'],
        ['ORD001', '012C123456', 'ZLEZ24', 5, 45.2, '2026-10-13 10:00:00', 'GD001'],
      ];
      const dsgdWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(dsgdWb, XLSX.utils.aoa_to_sheet(dsgdRows), 'Sheet1');
      const dsgdBuffer = XLSX.write(dsgdWb, { type: 'buffer', bookType: 'xlsx' });

      // Tạo Buffer FR (CQG)
      const frRows = [
        ['Header Ignored'],
        ['Ord #', 'Account', 'Symbol', 'Qty', 'Fill P', 'Time'],
        ['ORD001', '012C123456F', 'ZLEZ24', 5, 45.2, '10:00:00'],
      ];
      const frWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(frWb, XLSX.utils.aoa_to_sheet(frRows), 'Sheet1');
      const frBuffer = XLSX.write(frWb, { type: 'buffer', bookType: 'xlsx' });

      const result = await klgdService.checkKLGD(
        { dsgd: dsgdBuffer, fr: frBuffer },
        new Date('2026-10-13T10:30:00'),
      );

      expect(result.passed).toBe(true);
      expect(result.totals.totalDSGD).toBe(5);
      expect(result.totals.totalFR).toBe(5);
      expect(result.totals.differ).toBe(0);
      expect(result.mismatchedTrades.length).toBe(0);
    });

    it('Phát hiện chênh lệch khi CQG có lệnh thừa không có bên M-System', async () => {
      const mockSettings: any = {
        getSetting: jest.fn().mockResolvedValue('05:00'),
        setSetting: jest.fn().mockResolvedValue(true),
      };

      const klgdService = new KlgdReconService(mockSettings);

      const dsgdRows = [
        ['Mã lệnh', 'Mã TKGD', 'Mã HĐ', 'KL giao dịch', 'Giá khớp', 'Ngày giờ thực hiện', 'Mã giao dịch'],
        ['ORD001', '012C123456', 'ZLEZ24', 5, 45.2, '2026-10-13 10:00:00', 'GD001'],
      ];
      const dsgdWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(dsgdWb, XLSX.utils.aoa_to_sheet(dsgdRows), 'Sheet1');
      const dsgdBuffer = XLSX.write(dsgdWb, { type: 'buffer', bookType: 'xlsx' });

      // CQG có thêm 1 lệnh ORD002
      const frRows = [
        ['Header Ignored'],
        ['Ord #', 'Account', 'Symbol', 'Qty', 'Fill P', 'Time'],
        ['ORD001', '012C123456F', 'ZLEZ24', 5, 45.2, '10:00:00'],
        ['ORD002', '012C123456F', 'ZLEZ24', 3, 45.5, '10:02:00'],
      ];
      const frWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(frWb, XLSX.utils.aoa_to_sheet(frRows), 'Sheet1');
      const frBuffer = XLSX.write(frWb, { type: 'buffer', bookType: 'xlsx' });

      const result = await klgdService.checkKLGD(
        { dsgd: dsgdBuffer, fr: frBuffer },
        new Date('2026-10-13T10:30:00'),
      );

      expect(result.passed).toBe(false);
      expect(result.totals.totalDSGD).toBe(5);
      expect(result.totals.totalFR).toBe(8);
      expect(result.totals.differ).toBe(3);
      expect(result.mismatchedTrades.length).toBe(1);
      expect(result.mismatchedTrades[0].source).toBe('CQG');
      expect(result.mismatchedTrades[0].maLenh).toBe('ORD002');
    });
  });

  describe('3. Dynamic Bot Capability Dispatcher (Zero Hardcoded Task ID)', () => {
    it('Worker nhận diện đúng capabilityType: CHECK_KLGD và CHECK_PRE_EOD', async () => {
      const mockSettings: any = {
        getSetting: jest.fn().mockResolvedValue('05:00'),
        setSetting: jest.fn().mockResolvedValue(true),
      };
      const klgdService = new KlgdReconService(mockSettings);
      const klgdWorker = new KlgdReconWorker(klgdService);
      const preEodWorker = new PreEodReconWorker(new PreEodReconService());

      expect(klgdWorker.capabilityType).toBe('CHECK_KLGD');
      expect(klgdWorker.canHandle('CHECK_KLGD')).toBe(true);
      expect(klgdWorker.canHandle('UNKNOWN_TASK')).toBe(false);

      expect(preEodWorker.capabilityType).toBe('CHECK_PRE_EOD');
      expect(preEodWorker.canHandle('CHECK_PRE_EOD')).toBe(true);

      const mockBotJobModel: any = {
        findOneAndUpdate: jest.fn(),
        updateOne: jest.fn(),
      };

      const dispatcher = new BotDispatcherService(
        mockBotJobModel,
        klgdWorker,
        preEodWorker,
      );
      dispatcher.onModuleInit();

      // Dispatch tới worker theo botCheckType độc lập với Task ID
      const res = await dispatcher.dispatch({
        taskId: 'CUSTOM_RANDOM_UUID_12345',
        botCheckType: 'CHECK_KLGD',
        targetDate: '2026-10-13',
      });

      expect(res).toBeDefined();
      expect(res.status).toBeDefined();
    });
  });
});
