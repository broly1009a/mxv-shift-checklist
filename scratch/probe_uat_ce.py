import urllib.request
import re
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request('https://uat-coreexchange.mxv.com.vn/login', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, context=ctx) as res:
        html = res.read().decode('utf-8', errors='ignore')
        print('Login page status:', res.status)
        scripts = re.findall(r'src="([^"]+\.js)"', html)
        print('Found scripts on login:', scripts)
        for s in scripts:
            js_url = s if s.startswith('http') else f'https://uat-coreexchange.mxv.com.vn{s}'
            print('  Script:', js_url)
            try:
                js_req = urllib.request.Request(js_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(js_req, context=ctx) as js_res:
                    js_text = js_res.read().decode('utf-8', errors='ignore')
                    for match in re.finditer(r'client_secret[":\s=]+([a-zA-Z0-9_\-]+)', js_text):
                        print('   FOUND client_secret:', match.group(0))
                    for match in re.finditer(r'client_id[":\s=]+([a-zA-Z0-9_\-]+)', js_text):
                        print('   FOUND client_id:', match.group(0))
                    for match in re.finditer(r'Basic\s+([a-zA-Z0-9+/=]{20,})', js_text):
                        print('   FOUND Basic Auth:', match.group(0))
            except Exception as ex:
                print('   Error reading script:', ex)
except Exception as e:
    print('Login page error:', e)
