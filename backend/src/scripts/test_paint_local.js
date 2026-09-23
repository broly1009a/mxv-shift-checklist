const fs = require('fs');

const p = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD\\HoSo_DinhKem\\2026-09-16\\001C6332468\\CCCD Dương Hoàng Hải.paint';
const buf = fs.readFileSync(p);
console.log('Size:', buf.length);
const cmpCIdx = buf.indexOf('cmpC');
console.log('cmpC index:', cmpCIdx);
const zlib = require('zlib');
const extentData = buf.slice(573, 573 + 1216238);
const decomp = zlib.inflateRawSync(extentData);
console.log('Decompressed length:', decomp.length);

// In uncC box, component order:
// component_index: 2 (red), 1 (green), 0 (blue), 3 (alpha)
// or let's check component order from uncC:
// Red=2, Green=1, Blue=0, Alpha=3 -> This is BGRA!
// Let's write an uncompressed BMP or use sharp / canvas / python to save PNG
fs.writeFileSync('C:\\Users\\hiepth\\.gemini\\antigravity-ide\\brain\\bec17626-a0e5-4d71-a552-7005f70a217d\\raw_decompressed.bin', decomp);
console.log('Wrote raw_decompressed.bin!');




