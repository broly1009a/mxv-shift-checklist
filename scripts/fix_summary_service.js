const fs = require('fs');
const path = require('path');

const summaryPath = path.resolve('../mxv-cqg-download-investigation/backend/src/modules/trading-ops/services/recon-console-summary.service.ts');
let content = fs.readFileSync(summaryPath, 'utf8');

content = content.replace(/this\.ccpCeDownloaderService/g, 'this.ccpCeScraperService');
content = content.replace(
  "import { CcpCeDownloaderService } from '../../bot-engine/ccp-ce-downloader.service';",
  ""
);

fs.writeFileSync(summaryPath, content, 'utf8');
console.log('Fixed ccpCeScraperService references in recon-console-summary.service.ts');
