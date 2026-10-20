import urllib.request
import ssl
import re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

chunks = [
    '/_next/static/chunks/4bd1b696-100b9d70ed4e49c1.js',
    '/_next/static/chunks/1255-8bee835db2259fd5.js',
    '/_next/static/chunks/main-app-3a579a1962a8f13d.js',
    '/_next/static/chunks/cc28fd0e-c0edf9df97e4ecdd.js',
    '/_next/static/chunks/3139-fa281d044e4e5ddf.js',
    '/_next/static/chunks/3070-ad57dc4752a08e10.js',
    '/_next/static/chunks/7040-772495619cb6f50f.js',
    '/_next/static/chunks/545-2a0d1a68cbff0b00.js',
    '/_next/static/chunks/9687-09960af9edd65f25.js',
    '/_next/static/chunks/4522-b394fad89a69321d.js',
    '/_next/static/chunks/4790-7c39532cfc12f65b.js',
    '/_next/static/chunks/3380-3b8691f58db2b875.js',
    '/_next/static/chunks/app/layout-9daa9dbeaf56f25e.js',
    '/_next/static/chunks/app/%5B...slug%5D/page-1e238a533c71c2c8.js',
    '/_next/static/chunks/webpack-f2cc01969577c7ab.js',
]

for c in chunks:
    url = f'https://uat-coreexchange.mxv.com.vn{c}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx) as res:
            text = res.read().decode('utf-8', errors='ignore')
            for kw in ['decrypt', 'AES', 'Utf8', 'enc.Utf8']:
                if kw in text:
                    print(f'Chunk {c} matched {kw}')
                    for m in re.finditer(re.escape(kw), text):
                        idx = m.start()
                        print('  Snippet:', repr(text[max(0, idx - 80):min(len(text), idx + 120)]))
    except Exception as e:
        pass
