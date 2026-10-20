import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Check Windows M: drive
win_path = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup CE\Futures\2026\T10.2026"
print("Checking Windows path:", win_path)
if os.path.exists(win_path):
    print("Found Windows path! Subdirectories:")
    for d in os.listdir(win_path):
        print(" ", d)
else:
    print("Windows M: drive path does not exist on this machine, checking /mnt/qlgd-it on 10.0.0.26...")
