import paramiko
import json
import time
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImhpZXB0cnVvbmciLCJzdWIiOiI2YTJmYTlhOTY3NWM0N2VmODJiMThhZTkiLCJyb2xlIjoiQURNSU4iLCJkZXBhcnRtZW50SWQiOiI2YTJmYTAxODNjZDliMGRlMzVkNmQ0OTQiLCJwZXJtaXNzaW9ucyI6WyJWSUVXX0NIRUNLTElTVCIsIkVESVRfQ0hFQ0tMSVNUIiwiSU5JVElBTElaRV9TSElGVCIsIkNMT1NFX1NISUZUIiwiQUNDRVNTX01BUkdJTl9DSEFOR0UiLCJBQ0NFU1NfQVVUT19TSElGVCIsIkFDQ0VTU19IRUFMVEhfQ0hFQ0tTIiwiUkVTT0xWRV9JTkNJREVOVFMiLCJNQU5BR0VfVEVNUExBVEVTIiwiTUFOQUdFX1VTRVJTIiwiTUFOQUdFX1JPTEVTIiwiTUFOQUdFX0NBTEVOREFSIl0sImlhdCI6MTc5MjM3MzI1MiwiZXhwIjoxNzkyNDU5NjUyfQ.PcJeINdIQOGTQDyGWLBHlvKqPHr3KeenB9m5EcIEXhk'

payload = json.dumps({"sessionDay": "2026-10-19", "reports": ["FULL"]})
cmd = f"curl -s -k -X POST https://localhost/api/v1/bot-engine/trigger-download -H 'Authorization: Bearer {token}' -H 'Content-Type: application/json' -d '{payload}'"
stdin, stdout, stderr = ssh.exec_command(cmd)
res = stdout.read().decode('utf-8')
print('Trigger MS response:', res)

try:
    data = json.loads(res)
    job_id = data.get('jobId')
    print('Checking job:', job_id)
    for i in range(20):
        time.sleep(2)
        cmd_job = f"curl -s -k -H 'Authorization: Bearer {token}' https://localhost/api/v1/bot-engine/jobs/{job_id}"
        _, stdout_j, _ = ssh.exec_command(cmd_job)
        raw_j = stdout_j.read().decode('utf-8')
        j_data = json.loads(raw_j)
        status = j_data.get('status')
        print(f"[{i+1}] Status: {status}")
        if status in ['COMPLETED', 'FAILED']:
            print("Finished with status:", status)
            print("Error:", j_data.get('error'))
            print("Logs:")
            for l in j_data.get('logs', []):
                print("  ", l)
            break
except Exception as e:
    print('Error:', e)

ssh.close()
