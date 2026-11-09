const path = require('path');
const { Client } = require(path.join(__dirname, '../backend/node_modules/ssh2'));
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`cd /opt/mxv-checklist/backend && node -e '
    const { NestFactory } = require("@nestjs/core");
    const { AppModule } = require("./dist/app.module");
    const { SystemSettingsService } = require("./dist/modules/system-settings/system-settings.service");
    async function test() {
      const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
      const service = app.get(SystemSettingsService);
      const res1 = await service.verifyStoragePath("M:\\\\Tailieuchung\\\\QLGD-IT\\\\Quanlygiaodich\\\\Tai lieu hoat dong\\\\Backup ACM\\\\Futures");
      console.log("TEST 1 (Backup ACM\\\\Futures):", JSON.stringify(res1));
      const res2 = await service.verifyStoragePath("M:\\\\Tailieuchung\\\\QLGD-IT\\\\Quanlygiaodich\\\\Tai lieu hoat dong\\\\Backup MS\\\\ACM");
      console.log("TEST 2 (Backup MS\\\\ACM):", JSON.stringify(res2));
      await app.close();
      process.exit(0);
    }
    test().catch(err => { console.error(err); process.exit(1); });
  '`, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
