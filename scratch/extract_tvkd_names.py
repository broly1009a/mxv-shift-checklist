import openpyxl
import re
import json

p2 = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Bao cao - Thong ke\Thong ke so lot giao dich 2026.xlsx"
wb = openpyxl.load_workbook(p2, data_only=True)
ws9 = wb['T09.2026']

tvkd_dict = {}
for c in range(33, 97):
    val = ws9.cell(4, c).value
    if val:
        # e.g. 'HN\n001' or 'HH HCM\n012' or 'APEX\n080' or 'Dsmart 023' or 'Mario  028'
        lines = [l.strip() for l in str(val).split('\n') if l.strip()]
        if len(lines) == 2:
            short_name = lines[0]
            code_str = lines[1]
        elif len(lines) == 1:
            # try split by space from right
            m = re.search(r'^(.*?)\s*(\d{3}(?:,\s*\d{3})?)$', lines[0])
            if m:
                short_name = m.group(1).strip()
                code_str = m.group(2).strip()
            else:
                short_name = lines[0]
                code_str = ''
        else:
            continue
            
        # extract 3-digit codes
        codes = re.findall(r'\d{3}', code_str)
        for cd in codes:
            tvkd_dict[cd] = short_name

print(f"Extracted {len(tvkd_dict)} TVKDs from Thong ke so lot giao dich 2026.xlsx:")
print(json.dumps(tvkd_dict, ensure_ascii=False, indent=2))

