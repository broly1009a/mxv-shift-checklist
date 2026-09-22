import sys
import csv
import json

sys.stdout.reconfigure(encoding='utf-8')

import os

def inspect_file(fname):
    path = os.path.join(os.path.dirname(__file__), fname)
    with open(path, 'r', encoding='utf-8-sig', errors='replace') as f:
        reader = csv.reader(f)
        header = next(reader, None)
        rows = []
        for i in range(3):
            r = next(reader, None)
            if r:
                rows.append(r)
        
        print(f"================== {fname} ==================")
        print(f"Header columns ({len(header) if header else 0}):")
        if header:
            for idx, h in enumerate(header):
                print(f"  col[{idx}] = {h}")
        print(f"Sample rows ({len(rows)}):")
        for idx, r in enumerate(rows):
            print(f"  Row {idx+1}: {r}")

for f in ['DSGD.csv', 'TTM.csv', 'TTTT.csv', 'HH.csv']:
    inspect_file(f)
