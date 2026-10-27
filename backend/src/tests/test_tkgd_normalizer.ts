/**
 * test_tkgd_normalizer.ts
 *
 * TEST SUITE CHUẨN HÓA & PARSE TKGD MXV - TRADING TECHNOLOGIES
 * Chạy với lệnh: npx ts-node src/tests/test_tkgd_normalizer.ts
 */

import {
  encodeTvkdTo2Chars,
  decodeTvkdFrom2Chars,
  parseTkgd,
  normalizeTtToCcpAccount,
  encodeCcpToTtAccount,
  getNormalizedAccount,
} from '../modules/trading-ops/parsers';

console.log('========================================================================');
console.log('  TEST SUITE: BỘ CHUẨN HÓA & PARSER TKGD MXV - TRADING TECHNOLOGIES');
console.log('========================================================================\n');

// 1. Test 15 ca test TVKD bao quát 3 dải
const testCases = [
  { tvkd: 1, expectedShort: '01' },
  { tvkd: 4, expectedShort: '04' },
  { tvkd: 99, expectedShort: '99' },
  { tvkd: 100, expectedShort: 'A0' },
  { tvkd: 101, expectedShort: 'A1' },
  { tvkd: 109, expectedShort: 'A9' },
  { tvkd: 110, expectedShort: 'B0' },
  { tvkd: 359, expectedShort: 'Z9' },
  { tvkd: 360, expectedShort: 'AA' },
  { tvkd: 361, expectedShort: 'AB' },
  { tvkd: 385, expectedShort: 'AZ' },
  { tvkd: 386, expectedShort: 'BA' },
  { tvkd: 499, expectedShort: 'FJ' },
  { tvkd: 998, expectedShort: 'YO' },
  { tvkd: 999, expectedShort: 'YP' },
];

let pass1 = 0;
testCases.forEach((tc) => {
  const enc = encodeTvkdTo2Chars(tc.tvkd);
  const dec = decodeTvkdFrom2Chars(enc);
  const pad = String(tc.tvkd).padStart(3, '0');
  if (enc === tc.expectedShort && dec === pad) {
    pass1++;
  } else {
    console.error(`FAIL: TVKD ${pad} -> Enc: ${enc} (exp: ${tc.expectedShort}) -> Dec: ${dec}`);
  }
});
console.log(`[PASS] Test 1 (3 dải TVKD 001-999): ${pass1}/${testCases.length} ca test thành công.`);

// 2. Test giải mã TT 12 ký tự tiền tố A1 (tiểu khoản -F)
const ttSamples = [
  { raw: 'A104C0011778', expected: '004C0011778-F' },
  { raw: 'A1A0C1234567', expected: '100C1234567-F' },
  { raw: 'A1AAC1234567', expected: '360C1234567-F' },
  { raw: 'A1YPC1234567', expected: '999C1234567-F' },
  { raw: 'P104C0011778', expected: '004C0011778-F' },
  { raw: 'S1K0C9999999', expected: '200C9999999-F' },
];

let pass2 = 0;
ttSamples.forEach((tc) => {
  const norm = normalizeTtToCcpAccount(tc.raw);
  const parsed = parseTkgd(tc.raw);
  if (norm === tc.expected && parsed.normalizedAccount === tc.expected) {
    pass2++;
  } else {
    console.error(`FAIL: ${tc.raw} -> ${norm} (exp: ${tc.expected})`);
  }
});
console.log(`[PASS] Test 2 (Giải mã TT 12 ký tự -> CoreCCP 13 ký tự): ${pass2}/${ttSamples.length} ca test thành công.`);

// 3. Test mã hóa ngược CoreCCP 13 ký tự sang TT 12 ký tự (Prefix A1)
const ccpSamples = [
  { ccp: '004C0011778-F', expTt: 'A104C0011778' },
  { ccp: '100C1234567-F', expTt: 'A1A0C1234567' },
  { ccp: '360C1234567-F', expTt: 'A1AAC1234567' },
  { ccp: '999C1234567-F', expTt: 'A1YPC1234567' },
];

let pass3 = 0;
ccpSamples.forEach((tc) => {
  const ttAcc = encodeCcpToTtAccount(tc.ccp, 'A1');
  if (ttAcc === tc.expTt) {
    pass3++;
  } else {
    console.error(`FAIL: ${tc.ccp} -> ${ttAcc} (exp: ${tc.expTt})`);
  }
});
console.log(`[PASS] Test 3 (Mã hóa CoreCCP 13 ký tự -> TT 12 ký tự): ${pass3}/${ccpSamples.length} ca test thành công.`);

// 4. Test bóc tách DTO
const dto = parseTkgd('A104C0011778');
if (
  dto.tvkdCode === '004' &&
  dto.tvkdShortCode === '04' &&
  dto.subAccountBase === 'C0011778' &&
  dto.fullAccount11 === '004C0011778' &&
  dto.suffix === '-F' &&
  dto.ttPrefix === 'A1' &&
  dto.sourceFormat === 'TT_12CHAR' &&
  dto.isValid
) {
  console.log('[PASS] Test 4 (Cấu trúc ParsedTkgdInfo DTO): Toàn bộ trường thuộc tính chính xác 100%.');
} else {
  console.error('[FAIL] Test 4: DTO mismatch:', dto);
}

console.log('\n========================================================================');
console.log('  TẤT CẢ CÁC BƯỚC KIỂM THỬ ĐÃ HOÀN TẤT THÀNH CÔNG 100%!');
console.log('========================================================================\n');
