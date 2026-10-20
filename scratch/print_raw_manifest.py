import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request('https://uat-coreexchange.mxv.com.vn/assets-manifest.js', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx) as res:
    content = res.read().decode('utf-8', errors='ignore')

raw = content.split('"')[1]
print('raw start:', raw[:200])
