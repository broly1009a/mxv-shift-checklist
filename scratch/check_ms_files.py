import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

stdin, stdout, stderr = client.exec_command("ls -1 '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026/14.10'")
files = stdout.read().decode('utf-8', errors='ignore').strip().split('\n')
for i, f in enumerate(files, 1):
    print(f"{i:2d}. {f}")
client.close()
