const fs = require('fs');
const path = require('path');

// 1. Fix klgd-recon.controller.ts
const klgdPath = path.resolve('../mxv-cqg-download-investigation/backend/src/modules/trading-ops/controllers/klgd-recon.controller.ts');
if (fs.existsSync(klgdPath)) {
  let content = fs.readFileSync(klgdPath, 'utf8');
  if (!content.includes("from '../../shifts/shifts.service'")) {
    content = content.replace(
      "import { RpaScraperService } from '../../ingress/scrapers/rpa-scraper.service';",
      "import { RpaScraperService } from '../../ingress/scrapers/rpa-scraper.service';\nimport { ShiftsService } from '../../shifts/shifts.service';"
    );
    fs.writeFileSync(klgdPath, content, 'utf8');
    console.log('Fixed ShiftsService import in klgd-recon.controller.ts');
  }
}

// 2. Fix recon-console-summary.service.ts
const summaryPath = path.resolve('../mxv-cqg-download-investigation/backend/src/modules/trading-ops/services/recon-console-summary.service.ts');
if (fs.existsSync(summaryPath)) {
  let content = fs.readFileSync(summaryPath, 'utf8');
  if (!content.includes("from '../../bot-engine/ccp-ce-downloader.service'")) {
    content = content.replace(
      "import { ShiftsService } from '../../shifts/shifts.service';",
      "import { ShiftsService } from '../../shifts/shifts.service';\nimport { CcpCeDownloaderService } from '../../bot-engine/ccp-ce-downloader.service';"
    );
    fs.writeFileSync(summaryPath, content, 'utf8');
    console.log('Fixed CcpCeDownloaderService import in recon-console-summary.service.ts');
  }
}
