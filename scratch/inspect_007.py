import sys
sys.stdout.reconfigure(encoding='utf-8')
import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.1.0.16', port=22, username='vncadmin', password='CiC=,!2o26')

cmd = """mongosh mxv_tkgd_reconciler --quiet --eval '
  const r = db.clean_account_records.findOne({ maTKGD: "007C0012955" });
  print(JSON.stringify({
    accountType: r.accountType,
    accountTypes: r.accountTypes,
    hasACMRequest: r.noiDungMail?.hasACMRequest,
    maTKGD_ACM: r.noiDungMail?.maTKGD_ACM,
    hasCCP: !!r.ccp,
    ccpSubAccountCode: r.ccp?.subAccountCode,
    hasPhuLuc: !!r.phuLuc,
    phuLucCode: r.phuLuc?.maTKGD
  }, null, 2));
'"""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('utf-8', errors='replace'))
client.close()
