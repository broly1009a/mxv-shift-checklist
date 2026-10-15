const fs = require('fs');
const path = require('path');

const p = path.resolve('../mxv-cqg-download-investigation/backend/src/modules/ccp-clearing/services/ce-ccp-gtt.service.ts');
let c = fs.readFileSync(p, 'utf8');

if (!c.includes("import { decrypt } from '../../../shared';")) {
  c = c.replace(
    "import { CcpCeScraperService } from '../../ingress/scrapers/ccp-ce-scraper.service';",
    "import { CcpCeScraperService } from '../../ingress/scrapers/ccp-ce-scraper.service';\nimport { decrypt } from '../../../shared';"
  );
  fs.writeFileSync(p, c, 'utf8');
  console.log('Added decrypt import to ce-ccp-gtt.service.ts');
}
