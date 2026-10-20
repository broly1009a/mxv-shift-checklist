import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = 'https://uat-coreexchange.mxv.com.vn/_next/static/chunks/app/layout-9daa9dbeaf56f25e.js'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx) as res:
    text = res.read().decode('utf-8', errors='ignore')

idx = text.find('AppInitializer')
print(text[max(0, idx - 1000):min(len(text), idx + 1000)])
