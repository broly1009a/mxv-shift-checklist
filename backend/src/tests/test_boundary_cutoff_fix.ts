/**
 * TESTCASE XÁC MINH CƠ CHẾ BUFFER CUTOFF TIME CHIỀU 2 (CQG CUTOFF):
 * Kiểm tra việc triệt tiêu hiện tượng lệch ảo tại giây ranh giới:
 * 1. Lệnh khớp sau cutoff (> 18:22:50) -> đưa vào pendingSyncTrades.
 * 2. Lệnh khớp tại đúng giây cutoff (18:22:50) nhưng CQG chưa có (do ms > .000) -> đưa vào pendingSyncTrades.
 * 3. Lệnh khớp trong khoảng buffer 2s (18:22:49) nhưng CQG chưa có (do latency) -> đưa vào pendingSyncTrades.
 * 4. Lệnh khớp trong khoảng buffer (18:22:49) MÀ CQG ĐÃ CÓ -> giữ lại đối chiếu, khớp 100%.
 * 5. Lệnh khớp trước buffer (> 2s trước, vd 18:20:00) không có bên CQG -> báo LỆCH thật.
 */

import { parseTradeDateTime } from '../modules/trading-ops/helpers/trading-math.helper';

function testBoundaryCutoff() {
  const tradingDate = new Date('2026-10-19');
  const effectiveCqgCutoffTime = new Date('2026-10-19T11:22:50.000Z'); // 18:22:50 local
  const cqgCutoffBufferMs = 2000;
  const cqgBoundaryThreshold = new Date(effectiveCqgCutoffTime.getTime() - cqgCutoffBufferMs); // 18:22:48 local

  // Giả lập danh sách rawFrKeySet có chứa lệnh LRCF27_MATCHED tại 18:22:49
  const rawFrKeySet = new Set<string>([
    '002C1234567LRCF273458', // lệnh có bên CQG
  ]);

  const rawDsgdData = [
    {
      maLenh: 'ORD_AFTER_CUTOFF',
      maTKGD: '036C6961974',
      maHD: 'ZWAK27',
      giaKhop: 682,
      klGiaoDich: 2,
      ngayGio: '19-10-2026 18:22:56',
      combinedKey: '036C6961974ZWAK27682',
    },
    {
      maLenh: 'ORD_EXACT_SECOND',
      maTKGD: '080C8639792',
      maHD: 'ZWAH27',
      giaKhop: 675.5,
      klGiaoDich: 1,
      ngayGio: '19-10-2026 18:22:50',
      combinedKey: '080C8639792ZWAH27675.5',
    },
    {
      maLenh: 'ORD_BORDER_MISSING_1',
      maTKGD: '001C0669470',
      maHD: 'LRCF27',
      giaKhop: 3458,
      klGiaoDich: 1,
      ngayGio: '19-10-2026 18:22:49',
      combinedKey: '001C0669470LRCF273458',
    },
    {
      maLenh: 'ORD_BORDER_MISSING_2',
      maTKGD: '001C0669470',
      maHD: 'LRCF27',
      giaKhop: 3458,
      klGiaoDich: 1,
      ngayGio: '19-10-2026 18:22:49',
      combinedKey: '001C0669470LRCF273458',
    },
    {
      maLenh: 'ORD_BORDER_ALREADY_IN_CQG',
      maTKGD: '002C1234567',
      maHD: 'LRCF27',
      giaKhop: 3458,
      klGiaoDich: 1,
      ngayGio: '19-10-2026 18:22:49',
      combinedKey: '002C1234567LRCF273458', // có trong rawFrKeySet
    },
    {
      maLenh: 'ORD_EARLIER_REAL_MISMATCH',
      maTKGD: '099C9999999',
      maHD: 'ZWAH27',
      giaKhop: 670,
      klGiaoDich: 1,
      ngayGio: '19-10-2026 18:20:00', // trước buffer (18:20:00 < 18:22:48)
      combinedKey: '099C9999999ZWAH27670',
    },
  ];

  const pendingSyncTrades: any[] = [];
  const dsgdData = rawDsgdData.filter((gd) => {
    if (!gd.ngayGio) return true;
    const tradeTime = parseTradeDateTime(gd.ngayGio, tradingDate);
    if (!tradeTime) return true;

    if (effectiveCqgCutoffTime && !gd.maTKGD.toUpperCase().endsWith('A')) {
      const isLateTrade = tradeTime > effectiveCqgCutoffTime;
      const isBoundaryTrade =
        cqgBoundaryThreshold &&
        tradeTime >= cqgBoundaryThreshold &&
        !rawFrKeySet.has(gd.combinedKey);

      if (isLateTrade || isBoundaryTrade) {
        pendingSyncTrades.push({
          source: 'MSystem',
          maLenh: gd.maLenh,
          maTKGD: gd.maTKGD,
          maHD: gd.maHD,
          giaKhop: gd.giaKhop,
          klGiaoDich: gd.klGiaoDich,
          ngayGio: gd.ngayGio,
          note: isLateTrade
            ? `Sau cutoff (${effectiveCqgCutoffTime.toISOString()})`
            : `Sát cutoff buffer (${effectiveCqgCutoffTime.toISOString()})`,
        });
        return false;
      }
    }
    return true;
  });

  console.log('--- KẾT QUẢ TEST LOGIC BUFFER CUTOFF CHIỀU 2 ---');
  console.log('Tổng lệnh đưa vào pendingSyncTrades:', pendingSyncTrades.length);
  pendingSyncTrades.forEach((p) => {
    console.log(` • [Bảo lưu] ${p.maLenh} (TK ${p.maTKGD}, HĐ ${p.maHD}, Khớp: ${p.ngayGio}): ${p.note}`);
  });

  console.log('\nTổng lệnh giữ lại trong dsgdData để so khớp:');
  dsgdData.forEach((d) => {
    console.log(` • [Giữ lại] ${d.maLenh} (TK ${d.maTKGD}, HĐ ${d.maHD}, Khớp: ${d.ngayGio})`);
  });

  // Asserts
  const assert = (name: string, condition: boolean) => {
    if (condition) {
      console.log(` PASS: ${name}`);
    } else {
      console.error(` FAIL: ${name}`);
      process.exit(1);
    }
  };

  assert('Lệnh sau cutoff (18:22:56) được bảo lưu', pendingSyncTrades.some((p) => p.maLenh === 'ORD_AFTER_CUTOFF'));
  assert('Lệnh đúng giây cutoff (18:22:50) thiếu bên CQG được bảo lưu', pendingSyncTrades.some((p) => p.maLenh === 'ORD_EXACT_SECOND'));
  assert('Lệnh sát cutoff (18:22:49 #1) thiếu bên CQG được bảo lưu', pendingSyncTrades.some((p) => p.maLenh === 'ORD_BORDER_MISSING_1'));
  assert('Lệnh sát cutoff (18:22:49 #2) thiếu bên CQG được bảo lưu', pendingSyncTrades.some((p) => p.maLenh === 'ORD_BORDER_MISSING_2'));
  assert('Lệnh sát cutoff (18:22:49) ĐÃ CÓ BÊN CQG KHÔNG BỊ BẢO LƯU (giữ lại so khớp)', dsgdData.some((d) => d.maLenh === 'ORD_BORDER_ALREADY_IN_CQG'));
  assert('Lệnh trước cutoff (>2s trước, 18:20:00) KHÔNG BỊ BẢO LƯU (giữ lại để phát hiện lệch thật)', dsgdData.some((d) => d.maLenh === 'ORD_EARLIER_REAL_MISMATCH'));
}

testBoundaryCutoff();
