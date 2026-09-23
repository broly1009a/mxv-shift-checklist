import numpy as np
import cv2

raw_path = r'C:\Users\hiepth\.gemini\antigravity-ide\brain\bec17626-a0e5-4d71-a552-7005f70a217d\raw_decompressed.bin'
with open(raw_path, 'rb') as f:
    data = f.read()

arr = np.frombuffer(data, dtype=np.uint8)
img = arr.reshape((383, 1202, 4))

# Let's inspect component order:
# In uncC:
# component 0: blue
# component 1: green
# component 2: red
# component 3: alpha
# That is standard BGRA!
bgra = img.copy()
bgr = cv2.cvtColor(bgra, cv2.COLOR_BGRA2BGR)
out_path = r'C:\Users\hiepth\.gemini\antigravity-ide\brain\bec17626-a0e5-4d71-a552-7005f70a217d\paint_real.png'
cv2.imwrite(out_path, bgr)
print('Wrote paint_real.png successfully!')

# Also test RGB
rgb = cv2.cvtColor(bgra, cv2.COLOR_RGBA2BGR)
cv2.imwrite(r'C:\Users\hiepth\.gemini\antigravity-ide\brain\bec17626-a0e5-4d71-a552-7005f70a217d\paint_rgb.png', rgb)
