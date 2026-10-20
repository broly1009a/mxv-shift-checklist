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

# Search for where module containing `o.K` starts
pos = text.rfind('(0,o.K)()', 0, 66911)
print('pos:', pos)
# Find definition of o before pos
o_match = [m.start() for m in re.finditer(r'o\s*=\s*n\(\d+\)', text[:pos])]
if o_match:
    last_o = o_match[-1]
    print('last o:', text[last_o:last_o+50])
