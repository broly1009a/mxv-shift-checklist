const { execSync } = require('child_process');

try {
  const wmicOut = execSync('wmic process where "name=\'chrome.exe\'" get processid,commandline /format:csv').toString();
  const lines = wmicOut.split('\n').filter(l => l.includes('test_parallel_cqg'));
  console.log(`Tìm thấy ${lines.length} tiến trình test_parallel_cqg.`);
  for (const line of lines) {
    const parts = line.split(',');
    const pid = parts[parts.length - 1]?.trim();
    if (pid && !isNaN(pid)) {
      try {
        process.kill(Number(pid), 'SIGKILL');
        console.log(`Đã kill PID: ${pid}`);
      } catch (err) {
        console.log(`Không kill được PID ${pid}: ${err.message}`);
      }
    }
  }
} catch (e) {
  console.log('Error:', e.message);
}
