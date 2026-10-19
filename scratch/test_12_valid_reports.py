import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = """cd /opt/mxv-checklist/backend && node -e '
(async () => {
  require("dotenv").config();
  const { CoreCcpApiAdapter } = require("./dist/modules/ingress/adapters/coreccp-api.adapter");
  const adapter = new CoreCcpApiAdapter();
  const session = await adapter.getValidSession();
  const baseUrl = "https://coreccp.vnclear.vn";

  const validReports = [
    { key: "DSL_CCP", searchCode: "ORDERBOOK", file: "DSL CCP.xlsx" },
    { key: "DSGD_CCP", searchCode: "ORDERMATCH_DETAIL", file: "DSGD CCP.xlsx" },
    { key: "DSL_MM_CCP", searchCode: "ORDERBOOK_MM", file: "DSL MM CCP.xlsx" },
    { key: "TTM_CCP", searchCode: "OPEN_POSITION", file: "TTM CCP.xlsx" },
    { key: "TTTT", searchCode: "PNL_EXECUTED", file: "TTTT.xlsx" },
    { key: "QL_TT_TKGD", searchCode: "ACCTMARGIN_ALL", file: "QL TT TKGD.xlsx" },
    { key: "DSQLKQ_TKGD", searchCode: "ACCTMARGIN_POS", file: "DSQLKQ TKGD.xlsx" },
    { key: "NR", searchCode: "CASHTRANFER_HIST", file: "NR.xlsx" },
    { key: "DSTKGD_ACM", searchCode: "ACCOUNTS_INFO", file: "DSTKGD ACM.xlsx" },
    { key: "GTT_CCP", searchCode: "SETTLEMENT", file: "GTT CCP.xlsx" },
    { key: "HH", searchCode: "COMMODITY", file: "HH.xlsx" },
    { key: "TYGIA", searchCode: "CURRENCYEXCHANGERATE", file: "TYGIA.xlsx" },
  ];

  console.log("TESTING 12 VALID CORECCP REPORTS VIA REST JSON:");
  const t0 = Date.now();
  for (const r of validReports) {
    const tStart = Date.now();
    try {
      const res = await adapter.searchFullJson(session, r.searchCode, baseUrl, "/ORDERS/" + r.searchCode, {});
      console.log(`[PASS 200] ${r.file.padEnd(20)} (${res.rows.length} dong, ${Date.now() - tStart}ms)`);
    } catch (err) {
      console.log(`[FAIL]     ${r.file.padEnd(20)}: ${err.message}`);
    }
  }
  console.log(`TONG THOI GIAN: ${Date.now() - t0}ms`);
})();
'"""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('ascii', errors='ignore'))
print(stderr.read().decode('ascii', errors='ignore'))
client.close()
