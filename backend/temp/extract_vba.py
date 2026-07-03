import zipfile, re, sys

xlsm = r'c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-shift-checklist\marco\Marco Ghep file.xlsm'

with zipfile.ZipFile(xlsm, 'r') as z:
    vba = z.read('xl/vbaProject.bin')
    # Extract readable ASCII strings of length > 8
    pattern = re.compile(rb'[ -~]{8,}')
    strings = pattern.findall(vba)
    seen = set()
    for s in strings:
        try:
            decoded = s.decode('latin-1')
            if decoded not in seen:
                seen.add(decoded)
                print(decoded)
        except:
            pass
