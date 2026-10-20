import urllib.request
import ssl
import re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

chunks = [
    'https://coreexchange.mxv.com.vn/_next/static/chunks/4790-7c39532cfc12f65b.js',
]

for url in [
    'https://uat-coreexchange.mxv.com.vn/_next/static/chunks/4790-7c39532cfc12f65b.js',
]:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx) as res:
            text = res.read().decode('utf-8', errors='ignore')
            for kw in ['ORDERBOOK_ACM', 'ORDERBOOK_ALL_ACM', 'ORDERBOOK']:
                matches = list(re.finditer(re.escape(kw), text))
                print(f"Keyword '{kw}' in {url}: {len(matches)} matches")
                for m in matches[:5]:
                    idx = m.start()
                    print("  Snippet:", repr(text[max(0, idx-60):min(len(text), idx+100)]))
    except Exception as e:
        print(f"Error {url}: {e}")
