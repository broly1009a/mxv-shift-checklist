const fs = require('fs');
const path = require('path');

const p = path.resolve('../mxv-cqg-download-investigation/backend/src/modules/ccp-clearing/services/ce-ccp-gtt.service.ts');
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "resolveTradingSessionDate,\nimport { CcpCeScraperService } from '../../ingress/scrapers/ccp-ce-scraper.service';",
  "resolveTradingSessionDate,\n} from '../../bot-engine/helpers/bot-path.helper';\nimport { CcpCeScraperService } from '../../ingress/scrapers/ccp-ce-scraper.service';"
);

fs.writeFileSync(p, c, 'utf8');
console.log('Fixed syntax error in ce-ccp-gtt.service.ts');
