import urllib.request
import ssl
import re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = 'https://uat-coreexchange.mxv.com.vn/_next/static/chunks/4790-7c39532cfc12f65b.js'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx) as res:
    text = res.read().decode('utf-8', errors='ignore')

# Find where SSO_URL or CLIENT_ID or env-config is referenced
idx = text.find('CLIENT_ID or CLIENT_SECRET is not configured')
if idx != -1:
    print('Found reference! Surrounding code:')
    print(text[max(0, idx - 500):min(len(text), idx + 500)])
else:
    print('Not found!')
