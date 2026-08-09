import json
import sys

# Ensure UTF-8 output on Windows console
sys.stdout.reconfigure(encoding='utf-8')

with open('src/database/exported_templates.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for t in data:
    if 'Trading' in t['title'] or 'QLGD_OPS' in t.get('departmentCode', ''):
        print(f"=== {t['title']} ({t['sessionType']}) ===")
        for task in t['tasks']:
            print(f"  [{task['taskId']}] {task['taskName']} (parent: {task.get('parentTaskId')})")
