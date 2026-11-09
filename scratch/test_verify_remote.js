const path = require('path');
const { Client } = require(path.join(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
    const { resolveStoragePathCrossPlatform, resolveDynamicPath } = require('/opt/mxv-checklist/backend/dist/shared/helpers/file-path.helper');
    const fs = require('fs');
    const path = require('path');

    async function verifyStoragePath(rawPath, targetType = 'any') {
      if (!rawPath || !rawPath.trim()) return { success: false, message: 'empty' };
      const formatted = resolveDynamicPath(rawPath.trim());
      const resolved = resolveStoragePathCrossPlatform(formatted);
      const hasFileExt = /\\.(xlsx|xls|xlsm|xlsb|csv|txt|json|pdf|xml|doc|docx)$/i.test(resolved);
      const isFile = targetType === 'file' || (targetType === 'any' && hasFileExt);

      if (isFile) {
        return { isFile: true, resolved };
      }

      if (fs.existsSync(resolved)) {
        const stat = fs.statSync(resolved);
        if (!stat.isDirectory()) {
          return { success: false, exists: true, message: 'is file not dir' };
        }
        const testFile = path.join(resolved, '.write_test_' + Date.now());
        try {
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          return { success: true, exists: true, canWrite: true, resolvedPath: resolved, message: 'Thư mục này đang tồn tại và có đầy đủ quyền ghi dữ liệu.' };
        } catch (e) {
          return { success: false, exists: true, canWrite: false, resolvedPath: resolved, message: 'Thư mục có tồn tại nhưng không có quyền ghi: ' + e.message };
        }
      }
      return { success: false, exists: false, message: 'Không tồn tại' };
    }

    verifyStoragePath('M:\\\\Tailieuchung\\\\QLGD-IT\\\\Quanlygiaodich\\\\Tai lieu hoat dong\\\\Backup MS\\\\ACM').then(res => console.log('Result:', JSON.stringify(res, null, 2)));
  `;

  conn.exec(`cat << 'EOF' > /tmp/test_verify2.js\n${remoteScript}\nEOF\nnode /tmp/test_verify2.js`, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});
