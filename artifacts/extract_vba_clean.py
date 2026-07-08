import sys
import os

try:
    from oletools.olevba import VBA_Parser
except ImportError:
    print("oletools is not installed. Please install it by running: pip install oletools")
    sys.exit(1)

file_path = r"c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-shift-checklist\artifacts\copy.xlsm"
output_path = r"c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-shift-checklist\artifacts\vba_extracted_code.txt"

print(f"Parsing {file_path} using oletools...")
vba_parser = VBA_Parser(file_path)

if vba_parser.detect_vba_macros():
    print("VBA macros detected. Extracting...")
    out_lines = []
    for (subfilename, stream_path, vba_filename, vba_code) in vba_parser.extract_all_macros():
        out_lines.append("=" * 60)
        out_lines.append(f"Filename: {subfilename} | Stream: {stream_path} | Module: {vba_filename}")
        out_lines.append("=" * 60)
        out_lines.append(vba_code)
        out_lines.append("\n")
        
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(out_lines))
    print(f"VBA Code successfully extracted to {output_path}")
else:
    print("No VBA macros detected.")

vba_parser.close()
