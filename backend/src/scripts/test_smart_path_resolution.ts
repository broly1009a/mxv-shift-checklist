import {
  resolveDynamicPath,
  resolveStoragePathCrossPlatform,
} from '../modules/bot-engine/helpers/bot-path.helper';
import assert from 'assert';

console.log('--- TEST SMART PATH RESOLUTION & CROSS PLATFORM ---');

// 1. Dynamic Path Resolution
const template1 = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\Thong ke so lot giao dich ACM ${YYYY}.xlsx';
const resolved1 = resolveDynamicPath(template1, '2026-09-16');
assert.strictEqual(
  resolved1,
  'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\Thong ke so lot giao dich ACM 2026.xlsx',
  'Dynamic year ${YYYY} must be replaced correctly',
);
console.log('✓ Dynamic Year resolution passed:', resolved1);

const template2 = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Backup MS\\Futures\\${YYYY}\\T${MM}.${YYYY}\\${DD}.${MM}';
const resolved2 = resolveDynamicPath(template2, '2026-09-16');
assert.strictEqual(
  resolved2,
  'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Backup MS\\Futures\\2026\\T09.2026\\16.09',
  'Dynamic date variables must be replaced correctly',
);
console.log('✓ Full dynamic date resolution passed:', resolved2);

// 2. Cross-platform path resolution
// Test Windows UNC to Linux mapping simulation
process.env.STORAGE_MOUNT_LINUX = '/mnt/qlgd-it';
process.env.STORAGE_SHARE_WINDOWS = 'M:\\Tailieuchung\\QLGD-IT';

const uncPath = '\\\\10.0.0.26\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures';

console.log('Current platform:', process.platform);
const crossPath = resolveStoragePathCrossPlatform(uncPath);
console.log('✓ Resolved UNC path on current platform:', crossPath);

const linuxMountPath = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke ccp/test.xlsx';
const winFromLinux = resolveStoragePathCrossPlatform(linuxMountPath);
console.log('✓ Resolved Linux mount path on current platform:', winFromLinux);

console.log('ALL SMART PATH ASSERTIONS PASSED SUCCESSFULLY!');
