const fs = require('fs');

// 1. Ingress-config: replace @Post('test-connection-cast') with comment
let conf = fs.readFileSync('backend/src/modules/ingress/controllers/ingress-config.controller.ts', 'utf8');
conf = conf.replace("@Post('test-connection-cast')", "// [DEPRECATED/OFF] @Post('test-connection-cast')");
fs.writeFileSync('backend/src/modules/ingress/controllers/ingress-config.controller.ts', conf);
console.log('ingress-config updated!');

// 2. Ingress-download: off trigger-audit-cqg, trigger-audit-ms, trigger-audit-acm, download-ccp-report, download-ce-report, backup configs
let dl = fs.readFileSync('backend/src/modules/ingress/controllers/ingress-download.controller.ts', 'utf8');
const endpointsToOff = [
  "@Post('trigger-audit-cqg')",
  "@Post('trigger-audit-ms')",
  "@Post('trigger-audit-acm')",
  "@Post('download-ccp-report')",
  "@Post('download-ce-report')",
  "@Get('backup-ms/config')",
  "@Post('backup-ms/config')",
  "@Get('backup-cqg/config')",
  "@Post('backup-cqg/config')",
  "@Get('backup-acm/config')",
  "@Post('backup-acm/config')",
  "@Get('backup-ccp/schedule')",
  "@Post('backup-ccp/schedule')"
];

endpointsToOff.forEach(ep => {
  if (dl.includes(ep)) {
    dl = dl.replace(ep, "// [DEPRECATED/OFF] " + ep);
    console.log('Off: ' + ep);
  } else {
    console.log('Not found: ' + ep);
  }
});
fs.writeFileSync('backend/src/modules/ingress/controllers/ingress-download.controller.ts', dl);
console.log('ingress-download updated!');
