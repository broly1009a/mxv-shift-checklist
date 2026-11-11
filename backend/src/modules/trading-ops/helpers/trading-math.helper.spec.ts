import {
  parseCqgDateTime,
  parseTradeDateTime,
  parseCqgNumber,
  isIgnoredCommodity,
} from './trading-math.helper';

describe('TradingMathHelper - parseCqgDateTime & parseTradeDateTime', () => {
  describe('parseCqgDateTime - Core Bug Reproduction & Fix Verification', () => {
    it('phải parse chính xác ngày 10/11/2026 (November 10) từ chuỗi CQG 11/10/26 thay vì đảo thành 11/10 (October 11)', () => {
      const defDate = new Date(2026, 10, 10); // 10/11/2026
      const res = parseCqgDateTime('11/10/26 14:30:00.663', defDate);

      expect(res).not.toBeNull();
      expect(res!.getFullYear()).toBe(2026);
      expect(res!.getMonth()).toBe(10); // Month 11 (0-indexed: 10)
      expect(res!.getDate()).toBe(10);
      expect(res!.getHours()).toBe(14);
      expect(res!.getMinutes()).toBe(30);
      expect(res!.getSeconds()).toBe(0);
      expect(res!.getMilliseconds()).toBe(0); // Đã triệt tiêu mili-giây
    });

    it('phải parse chính xác lệnh đêm 11/11/2026 trong phiên 10/11/2026', () => {
      const defDate = new Date(2026, 10, 10); // 10/11/2026
      const res = parseCqgDateTime('11/11/26 01:45:00', defDate);

      expect(res).not.toBeNull();
      expect(res!.getFullYear()).toBe(2026);
      expect(res!.getMonth()).toBe(10); // Tháng 11
      expect(res!.getDate()).toBe(11); // Ngày 11
      expect(res!.getHours()).toBe(1);
      expect(res!.getMinutes()).toBe(45);
    });

    it('phải xử lý chính xác chuỗi thuần giờ (pure time) trong phiên đêm (< 6h)', () => {
      const defDate = new Date(2026, 10, 10); // 10/11/2026
      const res = parseCqgDateTime('00:57:00.123', defDate, 6);

      expect(res).not.toBeNull();
      expect(res!.getFullYear()).toBe(2026);
      expect(res!.getMonth()).toBe(10);
      expect(res!.getDate()).toBe(11); // Tự động sang ngày hôm sau D+1
      expect(res!.getHours()).toBe(0);
      expect(res!.getMinutes()).toBe(57);
      expect(res!.getSeconds()).toBe(0);
    });

    it('phải xử lý chính xác chuỗi thuần giờ (pure time) trong ban ngày (>= 6h)', () => {
      const defDate = new Date(2026, 10, 10); // 10/11/2026
      const res = parseCqgDateTime('15:30:00', defDate, 6);

      expect(res).not.toBeNull();
      expect(res!.getFullYear()).toBe(2026);
      expect(res!.getMonth()).toBe(10);
      expect(res!.getDate()).toBe(10); // Cùng ngày D
      expect(res!.getHours()).toBe(15);
      expect(res!.getMinutes()).toBe(30);
    });
  });

  describe('parseCqgDateTime - 12 Điểm Biên Trong Năm (Calendar Boundary Days)', () => {
    // 12 ngày trong năm có Ngày = Tháng - 1
    const boundaryDays = [
      { m: 1, d: 12, cqgStr: '01/12/26 10:00:00' },
      { m: 2, d: 1, cqgStr: '02/01/26 10:00:00' },
      { m: 3, d: 2, cqgStr: '03/02/26 10:00:00' },
      { m: 4, d: 3, cqgStr: '04/03/26 10:00:00' },
      { m: 5, d: 4, cqgStr: '05/04/26 10:00:00' },
      { m: 6, d: 5, cqgStr: '06/05/26 10:00:00' },
      { m: 7, d: 6, cqgStr: '07/06/26 10:00:00' },
      { m: 8, d: 7, cqgStr: '08/07/26 10:00:00' },
      { m: 9, d: 8, cqgStr: '09/08/26 10:00:00' },
      { m: 10, d: 9, cqgStr: '10/09/26 10:00:00' },
      { m: 11, d: 10, cqgStr: '11/10/26 10:00:00' },
      { m: 12, d: 11, cqgStr: '12/11/26 10:00:00' },
    ];

    boundaryDays.forEach(({ m, d, cqgStr }) => {
      it(`phải parse chính xác ngày biên ${d}/${m}/2026`, () => {
        const defDate = new Date(2026, m - 1, d);
        const res = parseCqgDateTime(cqgStr, defDate);
        expect(res).not.toBeNull();
        expect(res!.getFullYear()).toBe(2026);
        expect(res!.getMonth()).toBe(m - 1);
        expect(res!.getDate()).toBe(d);
      });
    });
  });

  describe('parseCqgDateTime - Chuyển Tiếp Tháng & Năm (Month-End & Year-End Rollovers)', () => {
    it('phải parse chính xác chuyển giao cuối tháng (31/10 -> 01/11)', () => {
      const defDate = new Date(2026, 9, 31); // 31/10/2026
      const res = parseCqgDateTime('11/01/26 02:00:00', defDate);

      expect(res).not.toBeNull();
      expect(res!.getFullYear()).toBe(2026);
      expect(res!.getMonth()).toBe(10); // Tháng 11
      expect(res!.getDate()).toBe(1);
    });

    it('phải parse chính xác chuyển giao cuối năm (31/12 -> 01/01)', () => {
      const defDate = new Date(2026, 11, 31); // 31/12/2026
      const res = parseCqgDateTime('01/01/27 03:00:00', defDate);

      expect(res).not.toBeNull();
      expect(res!.getFullYear()).toBe(2027);
      expect(res!.getMonth()).toBe(0); // Tháng 1
      expect(res!.getDate()).toBe(1);
    });

    it('phải parse chính xác năm nhuận 2028 (28/02 -> 29/02)', () => {
      const defDate = new Date(2028, 1, 28); // 28/02/2028
      const res = parseCqgDateTime('02/29/28 01:00:00', defDate);

      expect(res).not.toBeNull();
      expect(res!.getFullYear()).toBe(2028);
      expect(res!.getMonth()).toBe(1); // Tháng 2
      expect(res!.getDate()).toBe(29);
    });
  });

  describe('parseCqgDateTime - Clean Architecture (Zero Guessing) & Bit0 > 12 Guard', () => {
    it('phải nhận diện đúng ngày khi bit0 > 12 (ví dụ 15/07/26 không thể là tháng)', () => {
      const defDate = new Date(2026, 6, 15); // 15/07/2026
      const res = parseCqgDateTime('15/07/26 14:00:00', defDate);

      expect(res).not.toBeNull();
      expect(res!.getMonth()).toBe(6); // Tháng 7
      expect(res!.getDate()).toBe(15);
    });

    it('chuỗi CQG 10/11/26 theo đúng Contract US MM/DD/YY luôn tất định là ngày 11 Tháng 10 (October 11)', () => {
      const defDate = new Date(2026, 9, 11); // 11/10/2026
      const res = parseCqgDateTime('10/11/26 14:00:00', defDate);

      expect(res).not.toBeNull();
      expect(res!.getMonth()).toBe(9); // Tháng 10 (0-indexed: 9)
      expect(res!.getDate()).toBe(11);
    });
  });

  describe('parseTradeDateTime - M-System Parsing', () => {
    it('phải parse đúng định dạng chuẩn M-System dd-MM-yyyy HH:mm:ss', () => {
      const res = parseTradeDateTime('10/11/2026 14:30:15');
      expect(res).not.toBeNull();
      expect(res!.getFullYear()).toBe(2026);
      expect(res!.getMonth()).toBe(10);
      expect(res!.getDate()).toBe(10);
      expect(res!.getHours()).toBe(14);
      expect(res!.getMinutes()).toBe(30);
      expect(res!.getSeconds()).toBe(15);
    });

    it('phải parse đúng định dạng yyyyMMdd HH:mm:ss (Nano/ACM)', () => {
      const res = parseTradeDateTime('20261110 09:15:00');
      expect(res).not.toBeNull();
      expect(res!.getFullYear()).toBe(2026);
      expect(res!.getMonth()).toBe(10);
      expect(res!.getDate()).toBe(10);
    });
  });

  describe('Corner cases & Robustness', () => {
    it('trả về null với chuỗi rỗng hoặc không hợp lệ', () => {
      const defDate = new Date(2026, 10, 10);
      expect(parseCqgDateTime('', defDate)).toBeNull();
      expect(parseCqgDateTime('   ', defDate)).toBeNull();
      expect(parseCqgDateTime('abc', defDate)).toBeNull();
      expect(parseTradeDateTime('')).toBeNull();
    });

    it('parseCqgNumber hỗ trợ cả dấu phẩy và dấu chấm thập phân', () => {
      expect(parseCqgNumber('1,234.56')).toBe(1234.56);
      expect(parseCqgNumber('1.234,56')).toBe(1234.56);
      expect(parseCqgNumber('546.75')).toBe(546.75);
      expect(parseCqgNumber(100)).toBe(100);
      expect(parseCqgNumber(null)).toBe(0);
    });

    it('isIgnoredCommodity lọc chuẩn các mã hàng hóa bỏ qua', () => {
      expect(isIgnoredCommodity('TRUZ26')).toBe(true);
      expect(isIgnoredCommodity('ZFTZ26')).toBe(true);
      expect(isIgnoredCommodity('FEFZ26')).toBe(true);
      expect(isIgnoredCommodity('MPOZ26')).toBe(true);
      expect(isIgnoredCommodity('ZCEZ26')).toBe(false);
      expect(isIgnoredCommodity('CLEZ26')).toBe(false);
    });
  });
});

