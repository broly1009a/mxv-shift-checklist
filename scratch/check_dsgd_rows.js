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
      console.log("Total rows:", rows.length);
      console.log("Row 0:", rows[0]["STT"], rows[0]["Ngày giờ thực hiện"], rows[0]["Mã lệnh"]);
      console.log("Row 50:", rows[50]["STT"], rows[50]["Ngày giờ thực hiện"], rows[50]["Mã lệnh"]);
      console.log("Row 100:", rows[100]["STT"], rows[100]["Ngày giờ thực hiện"], rows[100]["Mã lệnh"]);
      console.log("Row 200:", rows[200]["STT"], rows[200]["Ngày giờ thực hiện"], rows[200]["Mã lệnh"]);
      console.log("Row 400:", rows[400]["STT"], rows[400]["Ngày giờ thực hiện"], rows[400]["Mã lệnh"]);
      console.log("Row 500:", rows[500]["STT"], rows[500]["Ngày giờ thực hiện"], rows[500]["Mã lệnh"]);
      console.log("Row 600:", rows[600]["STT"], rows[600]["Ngày giờ thực hiện"], rows[600]["Mã lệnh"]);
      console.log("Row last:", rows[rows.length-1]["STT"], rows[rows.length-1]["Ngày giờ thực hiện"], rows[rows.length-1]["Mã lệnh"]);

      // Sum lot:
      let sumNormal = 0;
      let sumAcm = 0;
      for (const r of rows) {
        const qty = Number(r["KL giao dịch"] || 0);
        const acc = String(r["Mã TKGD"] || "");
        if (acc.endsWith("A")) sumAcm += qty;
        else sumNormal += qty;
      }
      console.log("Current file sumNormal:", sumNormal, "sumAcm:", sumAcm);
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
