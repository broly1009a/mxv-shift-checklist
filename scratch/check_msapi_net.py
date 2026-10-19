import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

stdin, stdout, stderr = client.exec_command("curl -I --max-time 5 https://msapi.mxv.com.vn")
print("STDOUT:\n", stdout.read().decode('ascii', errors='ignore'))
print("STDERR:\n", stderr.read().decode('ascii', errors='ignore'))
client.close()
