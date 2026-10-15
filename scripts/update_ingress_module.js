const fs = require('fs');
const path = require('path');

const modulePath = path.resolve('../mxv-cqg-download-investigation/backend/src/modules/ingress/ingress.module.ts');
let content = fs.readFileSync(modulePath, 'utf8');

if (!content.includes('AcmEtpAdapter')) {
  content = content.replace(
    "import { AcmSftpAdapter } from './adapters/acm-sftp.adapter';",
    "import { AcmSftpAdapter } from './adapters/acm-sftp.adapter';\nimport { AcmEtpAdapter } from './adapters/acm-etp.adapter';"
  );
  content = content.replace(
    "AcmSftpAdapter,\n    // Facade Service",
    "AcmSftpAdapter,\n    AcmEtpAdapter,\n    // Facade Service"
  );
  content = content.replace(
    "AcmSftpAdapter,\n  ],\n})\nexport class IngressModule {}",
    "AcmSftpAdapter,\n    AcmEtpAdapter,\n  ],\n})\nexport class IngressModule {}"
  );
  fs.writeFileSync(modulePath, content, 'utf8');
  console.log('Updated ingress.module.ts successfully');
} else {
  console.log('AcmEtpAdapter already in ingress.module.ts');
}
