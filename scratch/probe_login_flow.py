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

# Step 1: GET /oauth2/authorize
base_url = 'https://uat-coreexchange.mxv.com.vn'
redirect_uri = f'{base_url}/validate_code'
auth_url = f'{base_url}/oauth2/authorize?client_id=web-exchange-mxv&redirect_uri={urllib.parse.quote(redirect_uri)}&response_type=code&scope=openid%20profile'

print('[1] GET authorize...')
req = urllib.request.Request(auth_url, headers={'User-Agent': 'Mozilla/5.0'})
res = opener.open(req)
print('   Status:', res.status, 'Final URL:', res.geturl())

# Step 2: Extract _csrf from login page
html = res.read().decode('utf-8', errors='ignore')
csrf_m = re.search(r'name=["\']_csrf["\']\s+value=["\']([^"\']+)["\']', html)
if not csrf_m:
    csrf_m = re.search(r'value=["\']([^"\']+)["\']\s+name=["\']_csrf["\']', html)
csrf = csrf_m.group(1) if csrf_m else None
print('   _csrf:', csrf)

# Step 3: POST /login
post_data = urllib.parse.urlencode({
    '_csrf': csrf,
    'username': 'hieptruong',
    'password': 'Taovipko0!',
    'page': 'login'
}).encode('utf-8')

print('[2] POST /login...')
req2 = urllib.request.Request(f'{base_url}/login', data=post_data, headers={
    'User-Agent': 'Mozilla/5.0',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Referer': f'{base_url}/login'
})
res2 = opener.open(req2)
print('   POST login status:', res2.status, 'Final URL:', res2.geturl())
code_url = res2.geturl()

# Step 4: Check what is returned at final URL
final_html = res2.read().decode('utf-8', errors='ignore')
print('   Final HTML length:', len(final_html))
scripts = re.findall(r'<script[^>]*src=["\']([^"\']+)["\']', final_html)
print('   Found scripts in validate_code page:', scripts)
inline_scripts = re.findall(r'<script[^>]*>(.*?)</script>', final_html, re.DOTALL)
print('   Inline scripts count:', len(inline_scripts))
for idx, s in enumerate(inline_scripts):
    print(f'   --- Inline script {idx} (len {len(s)}): ---')
    print(s[:500])
