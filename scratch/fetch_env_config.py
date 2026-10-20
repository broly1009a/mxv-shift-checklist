import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

urls = [
    'https://uat-coreexchange.mxv.com.vn/env-config.js',
    'https://uat-coreexchange.mxv.com.vn/assets-manifest.js',
    'https://uat-coreexchange.mxv.com.vn/config.js',
]

for u in urls:
    try:
        req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx) as res:
            content = res.read().decode('utf-8', errors='ignore')
            print(f'=== {u} (Status {res.status}) ===')
            print(content)
    except Exception as e:
        print(f'=== {u} ERROR: {e} ===')
