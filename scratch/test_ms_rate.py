import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = """python3 -c "
import urllib.request, json
session = json.load(open('/opt/mxv-checklist/backend/temp/ms_session.json'))
token = session['token']
req = urllib.request.Request('https://msapi.mxv.com.vn/market/exchangeRate?limit=20&offset=0&sort_by=asc(status)', headers={'Authorization': 'Bearer ' + token, 'Origin': 'https://msadmin.mxv.com.vn', 'Referer': 'https://msadmin.mxv.com.vn/'})
res = urllib.request.urlopen(req)
print(res.read().decode())
"
"""
stdin, stdout, stderr = client.exec_command(cmd)
print("Result from server:")
print(stdout.read().decode())
print(stderr.read().decode())
client.close()
