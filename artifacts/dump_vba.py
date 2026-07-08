import zipfile
import re
import os

dst = r"c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-shift-checklist\artifacts\copy.xlsm"

# Read the zip contents
with zipfile.ZipFile(dst, 'r') as z:
    if 'xl/vbaProject.bin' in z.namelist():
        vba_data = z.read('xl/vbaProject.bin')
        print(f"vbaProject.bin size: {len(vba_data)} bytes")
        
        # Extract readable ASCII/UTF-8 strings using a simpler regex
        strings = []
        for match in re.finditer(b'[\\x20-\\x7E\\x0D\\x0A\\x09]{4,}', vba_data):
            try:
                text = match.group(0).decode('ascii', errors='ignore')
                strings.append(text)
            except Exception:
                pass
        
        # Write extracted strings to file
        out_path = r"c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-shift-checklist\artifacts\vba_strings.txt"
        with open(out_path, 'w', encoding='utf-8') as f:
            for s in strings:
                f.write(s + '\n')
        print(f"Extracted strings saved to: {out_path}")
    else:
        print("xl/vbaProject.bin not found in zip.")
