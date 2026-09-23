import re
import unicodedata

lines = [
  'DGP WE SQN 4',
  'BS1 IZS LL',
  'H 4 NHN INSSZ WZ',
  '4 PCN SE',
  'H 1DVNM2030000476064203000047<<8',
  '030905 7M2809056VNM<<<<<<<<<<2',
  'PHAN<<SONSHUNG<<<<<<<<S5K<55SSS'
]

clean_lines = [re.sub(r'[^A-Z0-9<]', '', l) for l in lines if l]

clean_line2 = next((l for l in clean_lines if re.search(r'\d{6}[0-9]?[FM<]\d{6}', l) or re.search(r'\d{6}[0-9]?[FM<]', l)), None)
print("clean_line2:", clean_line2)

m_icao2 = re.search(r'(\d{6})([0-9])([FM<])(\d{6})([0-9])', clean_line2)
if m_icao2:
    dob_raw, dob_cd, sex_char, exp_raw, exp_cd = m_icao2.groups()
    yy = int(dob_raw[0:2])
    mm = int(dob_raw[2:4])
    dd = int(dob_raw[4:6])
    year = 1900 + yy if yy > 30 else 2000 + yy
    ngaySinh = f"{dd:02d}/{mm:02d}/{year}"
    gioiTinh = 'Nữ' if sex_char == 'F' else 'Nam'
    print("ngaySinh:", ngaySinh, "gioiTinh:", gioiTinh)

clean_line1 = next((l for l in clean_lines if re.search(r'[IDLT1]DVNM', l) or l.startswith('ID') or ('VNM' in l and re.search(r'\d{12}', l))), None)
print("clean_line1:", clean_line1)
m_end = re.search(r'(\d{12})<{1,2}', clean_line1)
if m_end:
    soCCCD = m_end.group(1)
    print("soCCCD:", soCCCD)

name_lines = [l for l in lines if '<<' in l and 'VNM' not in l and not re.search(r'\d{4,6}\s*[FM]', l)]
if name_lines:
    clean_raw = re.sub(r'[^A-Z<]', '', name_lines[0])
    parts = [p.replace('<', ' ').strip() for p in clean_raw.split('<<') if p.replace('<', ' ').strip()]
    surname = parts[0].strip()
    given = parts[1].strip()
    expected_name = "PHAN SƠN HƯNG"
    unaccented_exp = ''.join(c for c in unicodedata.normalize('NFD', expected_name.upper()) if unicodedata.category(c) != 'Mn').replace('Đ', 'D')
    exp_words = unaccented_exp.split()
    if len(exp_words) >= 2 and exp_words[0] == surname:
        all_given_match = all(w in given for w in exp_words[1:])
        if all_given_match:
            hoTenKhongDau = unaccented_exp
            print("hoTenKhongDau healed:", hoTenKhongDau)
