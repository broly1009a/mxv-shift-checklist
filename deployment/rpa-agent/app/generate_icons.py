import os
import sys
from PIL import Image, ImageDraw

base_png = os.path.join('app', 'assets', 'icon_base.png')
assets_dir = os.path.join('app', 'assets')

if not os.path.exists(base_png):
    print('[WARN] Khong tim thay icon_base.png, bo qua.')
    sys.exit(0)

# 1. Generate icon.ico
img = Image.open(base_png).convert('RGBA')
sizes = [(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)]
icons = [img.resize(s, Image.Resampling.LANCZOS) for s in sizes]
icons[0].save(os.path.join(assets_dir, 'icon.ico'), format='ICO', sizes=sizes, append_images=icons[1:])
print('[OK] Da tao icon.ico')

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
