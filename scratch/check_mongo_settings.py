import paramiko
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

py_script = '''
import json
from pymongo import MongoClient

client = MongoClient("mongodb://127.0.0.1:27017")
db = client["mxv_shift_checklist"]
settings = list(db["system_settings"].find({}, {"_id": 0, "key": 1, "value": 1}))

print("=== ALL MATCHING SETTINGS IN MONGODB ===")
for s in sorted(settings, key=lambda x: x.get("key", "")):
    k = s.get("key")
    v = s.get("value")
    if any(term in k.lower() for term in ["ccp", "stat", "macro", "path", "acm"]):
        print(f"  {k:<35}: {v}")
'''

stdin, stdout, stderr = ssh.exec_command(f"python3 -c '{py_script}'")
print(stdout.read().decode('utf-8', errors='replace'))
ssh.close()
