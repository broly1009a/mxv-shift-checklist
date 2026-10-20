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

idx = text.find('CLIENT_ID or CLIENT_SECRET is not configured')
# Search backwards for m = or function m
pos = text.rfind('m=', 0, idx)
print('pos m=:', pos)
if pos != -1:
    print(text[pos - 50:pos + 300])
