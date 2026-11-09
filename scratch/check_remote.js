const { execSync } = require('child_process');

function runSsh(cmd) {
  try {
    const res = execSync(`ssh administrator@10.0.0.26 "${cmd.replace(/"/g, '\\"')}"`, { encoding: 'utf8', timeout: 30000 });
    return res;
  } catch (err) {
    return err.stdout || err.message;
  }
}

console.log('=== T10 MS Days ===');
console.log(runSsh('ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup/TradingCheck/Futures/2026/T10.2026"'));

console.log('=== T10 ACM Days ===');
console.log(runSsh('ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/2026/T10.2026"'));

