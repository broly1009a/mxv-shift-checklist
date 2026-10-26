import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26')

cmd = """python3 -c "
import hashlib

def get_md5(p):
    with open(p, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()

base = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/23.10'
p1 = f'{base}/QL TT TKGD.xlsx'
p2 = f'{base}/QL TT TKGD truoc 4h20.xlsx'
md1 = get_md5(p1)
md2 = get_md5(p2)
print('MD5 p1:', md1)
print('MD5 p2:', md2)
print('Identical?', md1 == md2)
"
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8'))
ssh.close()
