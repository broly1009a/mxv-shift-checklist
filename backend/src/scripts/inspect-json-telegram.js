const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../database/exported_templates.json');
const content = fs.readFileSync(filePath, 'utf8');
const data = JSON.parse(content);

let count = 0;
data.forEach(tmpl => {
  tmpl.tasks.forEach(t => {
    if (
      (t.taskName && t.taskName.includes('Telegram')) ||
      (t.actionDescription && t.actionDescription.includes('Telegram'))
    ) {
      console.log(`[exported_templates.json] Task ${t.taskId}: Name="${t.taskName}"`);
      count++;
    }
  });
});

console.log(`Total Telegram occurrences in exported_templates.json: ${count}`);
