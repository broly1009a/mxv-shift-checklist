import os
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')
dir_path = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(dir_path, 'python_verification_result.json'), 'r', encoding='utf-8') as f:
    res = json.load(f)

print("Report generated successfully.")
