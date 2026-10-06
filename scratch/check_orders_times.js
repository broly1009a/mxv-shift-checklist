let Client;
try {
  Client = require('ssh2').Client;
} catch (e) {
  try {
    Client = require('c:/Users/hiepth/OneDrive - MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/node_modules/ssh2').Client;
  } catch (e2) {
    Client = require('../mock-sftp/node_modules/ssh2').Client;
  }
}

const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `
    cd /opt/mxv-checklist/backend && node -e '
      const xlsx = require("/opt/mxv-checklist/backend/node_modules/xlsx");
      const msFile = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T09.2026/30.09/DSGD.xlsx";
      const wb = xlsx.readFile(msFile);
      const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

      const testOrders = [
        "115612129", "115656655", "115686647", "115666671", "115641705",
        "115632742", "115671569", "115646193", "115642407", "115642408"
      ];

      for (const ord of testOrders) {
        const found = rows.find(r => String(r["Mã lệnh"] || "").includes(ord));
        if (found) {
          console.log("Ord:", ord, "| STT:", found["STT"], "| OrderTime:", found["Ngày giờ đặt lệnh"], "| ExecTime:", found["Ngày giờ thực hiện"]);
        } else {
          console.log("Ord:", ord, "NOT FOUND in current DSGD");
        }
      }
    '
  `;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
