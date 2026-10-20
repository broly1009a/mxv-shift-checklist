import urllib.request
import ssl
import re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Check all chunks mentioned in webpack or layout
urls = [
    'https://uat-coreexchange.mxv.com.vn/_next/static/chunks/webpack-f2cc01969577c7ab.js',
    'https://uat-coreexchange.mxv.com.vn/_next/static/chunks/main-app-3a579a1962a8f13d.js',
    'https://uat-coreexchange.mxv.com.vn/_next/static/chunks/app/layout-9daa9dbeaf56f25e.js',
    'https://uat-coreexchange.mxv.com.vn/_next/static/chunks/3380-3b8691f58db2b875.js',
]

for url in urls:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx) as res:
            text = res.read().decode('utf-8', errors='ignore')
            for kw in ['ASSETS', 'crypto', 'CryptoJS', '_env_ =', '_env_=']:
                if kw in text:
                    print(f'Match "{kw}" in {url}:')
                    for m in re.finditer(re.escape(kw), text):
                        idx = m.start()
                        print('  ', repr(text[max(0, idx - 100):min(len(text), idx + 200)]))
    except Exception as e:
        print(f'Error {url}: {e}')
