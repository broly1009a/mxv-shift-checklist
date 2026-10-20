import urllib.request
import ssl
import json
import base64
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request('https://uat-coreexchange.mxv.com.vn/assets-manifest.js', headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx) as res:
    content = res.read().decode('utf-8', errors='ignore')

raw = content.split('"')[1]
key_b64, payload_b64 = raw.split('fss', 1)

print('key_b64:', key_b64)
payload_json_str = base64.b64decode(payload_b64).decode('utf-8')
print('payload_json_str:', payload_json_str[:200])

payload = json.loads(payload_json_str)
key = base64.b64decode(key_b64)
iv = base64.b64decode(payload['iv'])
ciphertext = base64.b64decode(payload['data'])

cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
decryptor = cipher.decryptor()
decrypted = decryptor.update(ciphertext) + decryptor.finalize()

pad_len = decrypted[-1]
plaintext = decrypted[:-pad_len].decode('utf-8', errors='ignore')

print('=== DECRYPTED ENV CONFIG ===')
print(plaintext)
