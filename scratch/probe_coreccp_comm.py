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

  const res = await adapter.makeJsonPost(session, baseUrl, "/ccp/inquiry/maintain/COMMODITY/search/COMMODITY", {
    searchcode: "COMMODITY",
    search: {},
    filter: {},
    page: { pageIndex: 1, pageSize: 200 }
  }, "/PRODUCT/COMMODITY");

  const rows = res.data.data || res.data.payload?.data || [];
  console.log("Found commodities:", rows.length);
  for (const c of rows) {
    console.log(`Commodity: ${c.UACODE} - ${c.VN_FULLNAME}`);
    const contractRes = await adapter.makeJsonPost(session, baseUrl, "/ccp/inquiry/maintain/COMMODITY/search/INSTRUMENTS", {
      searchcode: "INSTRUMENTS",
      search: { KEYVAL: c.UACODE },
      filter: {},
      page: { pageIndex: 1, pageSize: 200 }
    }, "/PRODUCT/COMMODITY");
    const contracts = contractRes.data.data || contractRes.data.payload?.data || [];
    console.log(`  -> Contracts for ${c.UACODE}: ${contracts.length} contracts`);
    if (contracts.length > 0) {
      console.log(`     Sample contract: ${contracts[0].SYMBOL} - ${contracts[0].COMMODITY_DESC}`);
    }
  }
})();
'"""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('ascii', errors='ignore'))
print(stderr.read().decode('ascii', errors='ignore'))
client.close()
