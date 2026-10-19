import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

cmd = """cd /opt/mxv-checklist/backend && node -e '
(async () => {
  const fs = require("fs");
  const session = JSON.parse(fs.readFileSync("./temp/ms_session.json", "utf8"));
  const token = session.token;
  const baseUrl = "https://msapi.mxv.com.vn";
  const adminUrl = "https://msadmin.mxv.com.vn";

  const endpoints = [
    { key: "NKTTHT", url: "/approval/admin/activities/excel?sort_by=desc(datetime)" },
    { key: "DSTKGD-Futures", url: "/am/admin/investors/excel?subInvestorType[eq]=NULL" },
    { key: "DSTKGD-Spread", url: "/am/admin/investors/excel?subInvestorType[eq]=S" },
    { key: "DSTKGD-LME", url: "/am/admin/investors/excel?subInvestorType[eq]=LME" },
    { key: "DSTKGD-ACM", url: "/am/admin/investors/excel?subInvestorType[eq]=ACM" },
    { key: "TLQHSKQ", url: "/am/admin/margin-ratio-multiplier/investors/excel?sort_by=desc(createdDate)" },
    { key: "NR", url: "/am/admin/investors/marginTransactionHistory/excel" },
    { key: "DSTrader", url: "/am/admin/traders/excel?sort_by=desc(createdDate)" },
    { key: "DSLDK", url: "/order/admin/list/excel?status[in]=PARTIALLY_FILLED,FILLED" },
    { key: "DSLCK", url: "/order/admin/list/excel?status[in]=WORKING" },
    { key: "DSLH", url: "/order/admin/list/excel?status[in]=CANCELLED" },
    { key: "DSLK", url: "/order/admin/list/excel" },
    { key: "DSGD", url: "/transaction/admin/list/excel" },
    { key: "TTM", url: "/position/admin/open/excel" },
    { key: "TTTT", url: "/position/admin/settle/excel" },
    { key: "TTCDH", url: "/position/admin/settleLME/excel" },
    { key: "DSQLKQ", url: "/margin/admin/list/excel?limit=20&offset=0" },
    { key: "QLTKGD", url: "/margin/admin/status/excel" },
    { key: "QLTKGD âm KQ", url: "/margin/admin/status/negative/excel" }
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(baseUrl + ep.url, {
        headers: {
          authorization: `Bearer ${token}`,
          origin: adminUrl,
          referer: adminUrl + "/",
          "user-agent": "Mozilla/5.0"
        }
      });
      const len = (await res.arrayBuffer()).byteLength;
      console.log(`${ep.key.padEnd(16)} -> HTTP ${res.status} (${(len/1024).toFixed(1)} KB)`);
    } catch (e) {
      console.log(`${ep.key.padEnd(16)} -> ERR: ${e.message}`);
    }
  }
})();
'"""
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('ascii', errors='ignore'))
print(stderr.read().decode('ascii', errors='ignore'))
client.close()
