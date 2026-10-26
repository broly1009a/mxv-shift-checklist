import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=15)

py_script = """
import os, time

base = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/23.10'
for fn in ['QL TT TKGD.xlsx', 'QL TT TKGD truoc 4h20.xlsx', 'EOD_23.10.2026.xlsx', 'EOD.xlsx', 'TTTT_23.10.2026.xlsx', 'NR.xlsx']:
    p = os.path.join(base, fn)
    if os.path.exists(p):
        st = os.stat(p)
        print(f'{fn}: size={st.st_size} bytes, mtime={time.ctime(st.st_mtime)}')
"""

stdin, stdout, stderr = ssh.exec_command(f'python3 -c "{py_script}"')
print(stdout.read().decode('utf-8'))
ssh.close()
