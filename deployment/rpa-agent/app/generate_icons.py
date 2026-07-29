import os
import sys
import io
import struct
from PIL import Image, ImageDraw

base_png = os.path.join('app', 'assets', 'icon_base.png')
assets_dir = os.path.join('app', 'assets')

if not os.path.exists(base_png):
    print('[WARN] Khong tim thay icon_base.png, bo qua.')
    sys.exit(0)

# 1. Generate icon.ico — manual builder (Pillow ICO save has a known bug with multi-res)
img = Image.open(base_png).convert('RGBA')

# Auto-trim white/transparent border, then add small padding
bbox = img.getbbox()  # returns (left, top, right, bottom) of non-empty content
if bbox:
    img = img.crop(bbox)
w, h = img.size
max_dim = max(w, h)
padding = int(max_dim * 0.04)  # 4% padding on each side
canvas_size = max_dim + padding * 2
img_sq = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
scale = (canvas_size - padding * 2) / max_dim
new_w = int(w * scale)
new_h = int(h * scale)
resized_logo = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
paste_x = (canvas_size - new_w) // 2
paste_y = (canvas_size - new_h) // 2
img_sq.paste(resized_logo, (paste_x, paste_y), resized_logo)

sizes = [256, 128, 64, 48, 32, 16]
png_bufs = []
for s in sizes:
    resized = img_sq.resize((s, s), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    resized.save(buf, format='PNG')
    png_bufs.append(buf.getvalue())

# Build ICO binary manually (supports PNG-compressed entries)
n = len(sizes)
header = struct.pack('<HHH', 0, 1, n)  # reserved=0, type=1(ico), count
dir_entries = b''
offset = 6 + n * 16
for i, s in enumerate(sizes):
    w_b = 0 if s == 256 else s  # 0 means 256 in ICO format
    h_b = 0 if s == 256 else s
    data = png_bufs[i]
    dir_entries += struct.pack('<BBBBHHII', w_b, h_b, 0, 0, 1, 32, len(data), offset)
    offset += len(data)

ico_path = os.path.join(assets_dir, 'icon.ico')
with open(ico_path, 'wb') as f:
    f.write(header + dir_entries)
    for data in png_bufs:
        f.write(data)
print(f'[OK] Da tao icon.ico ({os.path.getsize(ico_path) // 1024} KB, {n} kich thuoc)')

# 2. Generate status icons (32x32 with indicator badge)
def make_status_icon(color, filename):
    canvas = Image.open(base_png).convert('RGBA')
    canvas = canvas.resize((32, 32), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(canvas)
    draw.ellipse([20, 20, 30, 30], fill=color, outline='white', width=1)
    canvas.save(os.path.join(assets_dir, filename), 'PNG')
    print('[OK] Da tao status icon:', filename)

make_status_icon('#27ae60', 'icon_online.png')
make_status_icon('#c0392b', 'icon_offline.png')
make_status_icon('#f39c12', 'icon_working.png')
