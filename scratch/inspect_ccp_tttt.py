import sys
import paramiko

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

    cmd = """ls -la '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T09.2026/16.09'"""
    stdin, stdout, stderr = client.exec_command(cmd)
    print(stdout.read().decode('utf-8', errors='replace'))

    print("=== FIND ALL 25 CCP REPORTS NAMES IN CODEBASE ===")
    cmd2 = """grep -rn "ccp" /opt/mxv-checklist/backend/dist/modules/ingress/scrapers/ccp-scraper* | head -n 30"""
    stdin, stdout, stderr = client.exec_command(cmd2)
    print(stdout.read().decode('utf-8', errors='replace'))

finally:
    client.close()
