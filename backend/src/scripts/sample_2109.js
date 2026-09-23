const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T09.2026/21.09';
  const cmd = `head -n 5 "${dir}/DSGD.csv"
echo "=== TTM ==="
head -n 5 "${dir}/TTM.csv"
echo "=== TTTT ==="
head -n 5 "${dir}/TTTT.csv"
echo "=== HH ==="
head -n 5 "${dir}/HH.csv"
`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', (d) => out += d.toString());
    stream.on('close', () => {
      console.log('SAMPLE DATA:');
      console.log(out);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
