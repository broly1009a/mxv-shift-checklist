const fs = require('fs');
const file = 'backend/src/shared/constants/bot-task-registry.ts';
let content = fs.readFileSync(file, 'utf8');

const target = "M:\\\\Trading\\\\Trading\\\\2026\\\\Bao cao so lieu GD 2026\\\\";
const replacement = "M:\\\\Trading\\\\Trading\\\\${YYYY}\\\\Bao cao so lieu GD ${YYYY}\\\\";

content = content.split(target).join(replacement);

fs.writeFileSync(file, content, 'utf8');
console.log('Replaced count:', content.split(replacement).length - 1);
