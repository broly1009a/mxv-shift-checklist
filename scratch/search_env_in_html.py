import urllib.request
import urllib.parse
import ssl
import re
import http.cookiejar

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj), urllib.request.HTTPSHandler(context=ctx))

base_url = 'https://uat-coreexchange.mxv.com.vn'
redirect_uri = f'{base_url}/validate_code'
auth_url = f'{base_url}/oauth2/authorize?client_id=web-exchange-mxv&redirect_uri={urllib.parse.quote(redirect_uri)}&response_type=code&scope=openid%20profile'

res = opener.open(urllib.request.Request(auth_url, headers={'User-Agent': 'Mozilla/5.0'}))
html = res.read().decode('utf-8', errors='ignore')
csrf_m = re.search(r'name=["\']_csrf["\']\s+value=["\']([^"\']+)["\']', html)
if not csrf_m:
    csrf_m = re.search(r'value=["\']([^"\']+)["\']\s+name=["\']_csrf["\']', html)
csrf = csrf_m.group(1)

post_data = urllib.parse.urlencode({
    '_csrf': csrf,
    'username': 'hieptruong',
    'password': 'Taovipko0!',
    'page': 'login'
}).encode('utf-8')

res2 = opener.open(urllib.request.Request(f'{base_url}/login', data=post_data, headers={
    'User-Agent': 'Mozilla/5.0',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Referer': f'{base_url}/login'
}))

final_html = res2.read().decode('utf-8', errors='ignore')
print('Looking for _env_ in validate_code HTML:')
for m in re.finditer(r'_env_', final_html):
    idx = m.start()
    print('  Snippet:', final_html[max(0, idx - 100):min(len(final_html), idx + 200)])

# Also search for all <script tags in final_html
print('\nAll scripts in HTML:')
for s in re.finditer(r'<script([^>]*)>(.*?)</script>', final_html, re.DOTALL):
    attrs = s.group(1)
    body = s.group(2).strip()
    if body and '_env_' in body or 'CLIENT' in body or 'api' in body:
        print('Matched script tag body:', body[:500])
    elif attrs:
        print('Script src:', attrs)
