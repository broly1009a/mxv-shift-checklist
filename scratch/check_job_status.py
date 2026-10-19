import paramiko
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImhpZXB0cnVvbmciLCJzdWIiOiI2YTJmYTlhOTY3NWM0N2VmODJiMThhZTkiLCJyb2xlIjoiQURNSU4iLCJkZXBhcnRtZW50SWQiOiI2YTJmYTAxODNjZDliMGRlMzVkNmQ0OTQiLCJwZXJtaXNzaW9ucyI6WyJWSUVXX0NIRUNLTElTVCIsIkVESVRfQ0hFQ0tMSVNUIiwiSU5JVElBTElaRV9TSElGVCIsIkNMT1NFX1NISUZUIiwiQUNDRVNTX01BUkdJTl9DSEFOR0UiLCJBQ0NFU1NfQVVUT19TSElGVCIsIkFDQ0VTU19IRUFMVEhfQ0hFQ0tTIiwiUkVTT0xWRV9JTkNJREVOVFMiLCJNQU5BR0VfVEVNUExBVEVTIiwiTUFOQUdFX1VTRVJTIiwiTUFOQUdFX1JPTEVTIiwiTUFOQUdFX0NBTEVOREFSIl0sImlhdCI6MTc5MjM3MzI1MiwiZXhwIjoxNzkyNDU5NjUyfQ.PcJeINdIQOGTQDyGWLBHlvKqPHr3KeenB9m5EcIEXhk'

cmd = f'curl -s -k -H "Authorization: Bearer {token}" https://localhost/api/v1/bot-engine/jobs/6ad5db4c8b0b58d2e6acf6d8'
_, stdout, _ = ssh.exec_command(cmd)
res = stdout.read().decode('utf-8')
data = json.loads(res)
print('Job Status:', data.get('status'))
print('Job Error:', data.get('error'))
print('Result Files:', len(data.get('result', {}).get('files', [])) if data.get('result') else 0)
print('Logs:')
for l in data.get('logs', []):
    print('  ', l)
ssh.close()
