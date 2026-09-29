import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

for folder in ['Backup ACM', 'Backup MS', 'Backup CQG']:
    p = os.path.join(r'M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong', folder, r'Futures\2026\T09.2026\24.09')
    print(f"\n=== {folder} ({p}) ===")
    if os.path.exists(p):
        for f in os.listdir(p):
            sz = os.path.getsize(os.path.join(p, f))
            print(f"  {f} ({sz:,} bytes)")
    else:
        print("  Not found")
