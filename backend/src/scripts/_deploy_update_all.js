const { Client } = require('ssh2');
const path = require('path');
const conn = new Client();

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;

    const filesToUpload = [
      // 1. Python worker (cả src và dist)
      {
        local: path.resolve(__dirname, 'python/tkgd_extractor_worker.py'),
        remote: '/opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py',
      },
      {
        local: path.resolve(__dirname, 'python/tkgd_extractor_worker.py'),
        remote: '/opt/mxv-checklist/backend/dist/scripts/python/tkgd_extractor_worker.py',
      },
      // 2. TypeScript Sources (.ts)
      {
        local: path.resolve(__dirname, '../modules/tkgd-automation/tkgd-automation.service.ts'),
        remote: '/opt/mxv-checklist/backend/src/modules/tkgd-automation/tkgd-automation.service.ts',
      },
      {
        local: path.resolve(__dirname, '../modules/tkgd-automation/tkgd-automation.controller.ts'),
        remote: '/opt/mxv-checklist/backend/src/modules/tkgd-automation/tkgd-automation.controller.ts',
      },
      {
        local: path.resolve(__dirname, '../modules/bot-engine/helpers/tkgd-reconcile-rules.helper.ts'),
        remote: '/opt/mxv-checklist/backend/src/modules/bot-engine/helpers/tkgd-reconcile-rules.helper.ts',
      },
      {
        local: path.resolve(__dirname, '../modules/bot-engine/helpers/tkgd-mail-parser.helper.ts'),
        remote: '/opt/mxv-checklist/backend/src/modules/bot-engine/helpers/tkgd-mail-parser.helper.ts',
      },
      {
        local: path.resolve(__dirname, '../modules/bot-engine/helpers/tkgd-python-bridge.helper.ts'),
        remote: '/opt/mxv-checklist/backend/src/modules/bot-engine/helpers/tkgd-python-bridge.helper.ts',
      },
      {
        local: path.resolve(__dirname, '../modules/bot-engine/helpers/tkgd-document-classifier.helper.ts'),
        remote: '/opt/mxv-checklist/backend/src/modules/bot-engine/helpers/tkgd-document-classifier.helper.ts',
      },
      {
        local: path.resolve(__dirname, 'rescrape_ms_missing_cccd.ts'),
        remote: '/opt/mxv-checklist/backend/src/scripts/rescrape_ms_missing_cccd.ts',
      },
      // 3. Compiled JavaScripts (.js)
      {
        local: path.resolve(__dirname, '../../dist/modules/tkgd-automation/tkgd-automation.service.js'),
        remote: '/opt/mxv-checklist/backend/dist/modules/tkgd-automation/tkgd-automation.service.js',
      },
      {
        local: path.resolve(__dirname, '../../dist/modules/tkgd-automation/tkgd-automation.controller.js'),
        remote: '/opt/mxv-checklist/backend/dist/modules/tkgd-automation/tkgd-automation.controller.js',
      },
      {
        local: path.resolve(__dirname, '../../dist/modules/bot-engine/helpers/tkgd-reconcile-rules.helper.js'),
        remote: '/opt/mxv-checklist/backend/dist/modules/bot-engine/helpers/tkgd-reconcile-rules.helper.js',
      },
      {
        local: path.resolve(__dirname, '../../dist/modules/bot-engine/helpers/tkgd-mail-parser.helper.js'),
        remote: '/opt/mxv-checklist/backend/dist/modules/bot-engine/helpers/tkgd-mail-parser.helper.js',
      },
      {
        local: path.resolve(__dirname, '../../dist/modules/bot-engine/helpers/tkgd-python-bridge.helper.js'),
        remote: '/opt/mxv-checklist/backend/dist/modules/bot-engine/helpers/tkgd-python-bridge.helper.js',
      },
      {
        local: path.resolve(__dirname, '../modules/tkgd-automation/services/tkgd-dev-remediation.service.ts'),
        remote: '/opt/mxv-checklist/backend/src/modules/tkgd-automation/services/tkgd-dev-remediation.service.ts',
      },
      {
        local: path.resolve(__dirname, '../../dist/modules/tkgd-automation/services/tkgd-dev-remediation.service.js'),
        remote: '/opt/mxv-checklist/backend/dist/modules/tkgd-automation/services/tkgd-dev-remediation.service.js',
      },
      {
        local: path.resolve(__dirname, '../modules/tkgd-automation/tkgd-automation.module.ts'),
        remote: '/opt/mxv-checklist/backend/src/modules/tkgd-automation/tkgd-automation.module.ts',
      },
      {
        local: path.resolve(__dirname, '../../dist/modules/tkgd-automation/tkgd-automation.module.js'),
        remote: '/opt/mxv-checklist/backend/dist/modules/tkgd-automation/tkgd-automation.module.js',
      },
      {
        local: path.resolve(__dirname, '../../dist/modules/bot-engine/helpers/tkgd-document-classifier.helper.js'),
        remote: '/opt/mxv-checklist/backend/dist/modules/bot-engine/helpers/tkgd-document-classifier.helper.js',
      },
      // 4. Frontend Components
      {
        local: path.resolve(__dirname, '../../../frontend/src/features/tkgd/services/tkgd.api.ts'),
        remote: '/opt/mxv-checklist/frontend/src/features/tkgd/services/tkgd.api.ts',
      },
      {
        local: path.resolve(__dirname, '../../../frontend/src/features/tkgd/components/modal/TkgdDevRemediationModal.tsx'),
        remote: '/opt/mxv-checklist/frontend/src/features/tkgd/components/modal/TkgdDevRemediationModal.tsx',
      },
      {
        local: path.resolve(__dirname, '../../../frontend/src/features/tkgd/components/modal/TabDataComparison.tsx'),
        remote: '/opt/mxv-checklist/frontend/src/features/tkgd/components/modal/TabDataComparison.tsx',
      },
      {
        local: path.resolve(__dirname, '../../../frontend/src/features/tkgd/components/TkgdRecordsTable.tsx'),
        remote: '/opt/mxv-checklist/frontend/src/features/tkgd/components/TkgdRecordsTable.tsx',
      },
      {
        local: path.resolve(__dirname, '../../../frontend/src/features/tkgd/components/TkgdActionToolbar.tsx'),
        remote: '/opt/mxv-checklist/frontend/src/features/tkgd/components/TkgdActionToolbar.tsx',
      },
      {
        local: path.resolve(__dirname, '../../../frontend/src/features/tkgd/components/TkgdDashboard.tsx'),
        remote: '/opt/mxv-checklist/frontend/src/features/tkgd/components/TkgdDashboard.tsx',
      },
      // 5. Inspector Tool
      {
        local: path.resolve(__dirname, 'tkgd_case_inspector.js'),
        remote: '/opt/mxv-checklist/backend/src/scripts/tkgd_case_inspector.js',
      },
    ];

    let count = 0;
    const uploadNext = (idx) => {
      if (idx >= filesToUpload.length) {
        console.log('TẤT CẢ FILE ĐÃ ĐƯỢC UPLOAD LÊN UBUNTU THÀNH CÔNG!');
        conn.exec('pm2 restart mxv-backend && pm2 restart mxv-frontend', (e2, stream) => {
          if (e2) throw e2;
          let out = '';
          stream.on('data', d => out += d.toString());
          stream.on('close', () => {
            console.log('PM2 RESTART OUTPUT:\n', out);
            conn.end();
          });
        });
        return;
      }

      const item = filesToUpload[idx];
      sftp.fastPut(item.local, item.remote, (e) => {
        if (e) {
          console.error('LỖI UPLOAD ' + item.remote + ':', e);
          conn.end();
          return;
        }
        console.log('[' + (idx + 1) + '/' + filesToUpload.length + '] ĐÃ UPLOAD: ' + item.remote);
        uploadNext(idx + 1);
      });
    };

    uploadNext(0);
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
