import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26')

cmd = """cd /opt/mxv-checklist/backend && node -e "
  const { CoreCcpApiAdapter } = require('./dist/modules/ingress/adapters/coreccp-api.adapter');
  console.log('Inspecting ACCTMARGIN_ALL config...');
"
"""

stdin, stdout, stderr = ssh.exec_command(cmd)
print(stdout.read().decode('utf-8'))
ssh.close()
