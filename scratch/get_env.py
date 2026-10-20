import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request('https://uat-coreexchange.mxv.com.vn/env-config.js', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, context=ctx) as res:
        print('Status:', res.status)
        print(res.read().decode('utf-8', errors='ignore'))
except Exception as e:
    print('Error:', e)
