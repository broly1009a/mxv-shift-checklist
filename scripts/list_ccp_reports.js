const fs = require('fs');
const content = fs.readFileSync('coreccp-api-client/src/types.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((l) => {
  const match = l.match(/'([A-Z0-9_]+)':\s*\{/);
  if (match) console.log(match[1]);
});
