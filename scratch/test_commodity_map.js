const path = require('path');
const { BGS_RAW_TO_STD_MAP, getBgsCommodityMetadata } = require(path.resolve('backend/dist/modules/trading-ops/constants/bgs-commodity-catalog.constant'));

const roots = ['SIL', 'ZCE', 'ZLE', 'ZSE', 'C.ZCE', 'SI5CO', 'PL1NY', 'CP2CO'];
for (const r of roots) {
  console.log(r, '->', getBgsCommodityMetadata(r), 'in MAP:', BGS_RAW_TO_STD_MAP[r]);
}
