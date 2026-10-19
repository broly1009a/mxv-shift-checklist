import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = """curl -s https://msadmin.mxv.com.vn/assets/index-CpbOax8e.js | grep -o -E '[a-zA-Z0-9_]*export[a-zA-Z0-9_]*' | sort -u | head -n 30"""
stdin, stdout, stderr = client.exec_command(cmd)
print("EXPORT_PATTERNS:\n", stdout.read().decode('ascii', errors='ignore'))
client.close()
