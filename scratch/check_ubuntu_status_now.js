const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const { MongoClient } = require('/opt/mxv-checklist/backend/node_modules/mongodb');

async function main() {
    const client = new MongoClient('mongodb://127.0.0.1:27017');
    await client.connect();

    for (const dbName of ['trading_mxv', 'mxv_shift_checklist']) {
        const db = client.db(dbName);
        console.log(\`=== DATABASE: \${dbName} ===\`);
        const snapCol = db.collection('monthly_report_snapshots');
        const snap = await snapCol.findOne({ monthYear: '2026-10' });
        if (snap) {
            console.log(\`  Snapshot 2026-10 found (status=\${snap.status}, generatedAt=\${snap.generatedAt}):\`);
            console.log(\`    CQG Summary: lotCurrent=\${snap.section1Tvkd?.cqg?.summary?.lotCurrentMonth}, tradingDays=\${snap.section1Tvkd?.cqg?.summary?.tradingDaysCount}\`);
            console.log(\`    ACM Summary: lotCurrent=\${snap.section1Tvkd?.acm?.summary?.lotCurrentMonth}, tradingDays=\${snap.section1Tvkd?.acm?.summary?.tradingDaysCount}\`);
            console.log(\`    Total CQG Members=\${snap.section1Tvkd?.cqg?.items?.length}, ACM Members=\${snap.section1Tvkd?.acm?.items?.length}\`);
            const gcl = (snap.section1Tvkd?.cqg?.items || []).find(x => x.tvkdCode === '003');
            if (gcl) {
                console.log(\`    Gia Cát Lợi (003): lot=\${gcl.lotCurrentMonth}, peakDate=\${gcl.maxDate}, peakLot=\${gcl.maxLotDay}, tradingDays=\${gcl.tradingDaysCount}\`);
            }
        } else {
            console.log('  Snapshot 2026-10 NOT FOUND.');
        }

        const statsCol = db.collection('daily_trading_stats');
        const count = await statsCol.countDocuments({ date: /^2026-10/ });
        const distinctDates = await statsCol.distinct('date', { date: /^2026-10/ });
        console.log(\`  daily_trading_stats 2026-10: count=\${count}, distinct dates (\${distinctDates.length})=\${distinctDates.sort().join(', ')}\`);

        const settingsCol = db.collection('system_settings');
        const ccpPathSetting = await settingsCol.findOne({ key: 'bot_backup_path_ccp' });
        const msPathSetting = await settingsCol.findOne({ key: 'bot_backup_path_ms' });
        console.log(\`  bot_backup_path_ms = \${msPathSetting?.value}\`);
        console.log(\`  bot_backup_path_ccp = \${ccpPathSetting?.value}\`);
    }

    await client.close();
}
main().catch(console.error);
`;

  const cmd = `cat << 'EOF' > /tmp/check_ubuntu_status_now.js\n${remoteNode}\nEOF\nnode /tmp/check_ubuntu_status_now.js\nrm -f /tmp/check_ubuntu_status_now.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });
