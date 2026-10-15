const fs = require('fs');
const path = require('path');

const servicePath = path.resolve('../mxv-cqg-download-investigation/backend/src/modules/ingress/ingress.service.ts');
let content = fs.readFileSync(servicePath, 'utf8');

content = content.replace(
  "if (source === 'MS' || source === 'CORE_EX') {\n        return this.coreExApiAdapter.download('MS', { ...options, targetDirectory: outputDirectory });",
  "if (source === 'CORE_EX') {\n        return this.coreExApiAdapter.download('CORE_EX', { ...options, targetDirectory: outputDirectory });\n      } else if (source === 'MS') {\n        return this.coreExApiAdapter.download('MS', { ...options, targetDirectory: outputDirectory });"
);

fs.writeFileSync(servicePath, content, 'utf8');
console.log('Cleaned up CORE_EX branch in ingress.service.ts');
