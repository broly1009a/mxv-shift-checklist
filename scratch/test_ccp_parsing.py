import os
import sys
import unicodedata
import re
import pandas as pd

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

CCP_DIR = r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Backup CCP\Futures\2026\T10.2026\26.10"

def normalize_header_key(s):
    if s is None:
        return ''
    s = str(s).lower()
    s = unicodedata.normalize('NFD', s)
    s = re.sub(r'[\u0300-\u036f]', '', s)
    s = re.sub(r'[^a-z0-9]', '', s)
    return s

def build_ccp_header_map(headers):
    header_map = {}
    for i, h in enumerate(headers):
        k = normalize_header_key(h)
        if k and k not in header_map:
            header_map[k] = i
    return header_map

def resolve_col_idx(header_map, aliases, default_idx):
    if not header_map:
        return default_idx
    for a in aliases:
        k = normalize_header_key(a)
        if k in header_map:
            return header_map[k]
    return default_idx

print("=" * 80)
print("KIỂM CHỨNG TOÀN DIỆN LOGIC PARSE CCP TRÊN DỮ LIỆU THỰC TẾ 26/10/2026")
print("=" * 80)

# 1. TEST DSGD CCP
dsgd_file = os.path.join(CCP_DIR, "DSGD CCP.xlsx")
df_dsgd = pd.read_excel(dsgd_file)
headers = list(df_dsgd.columns)
hmap = build_ccp_header_map(headers)

print("\n1. KIỂM TRA MAPPING CỘT DSGD CCP:")
idxTKGD = resolve_col_idx(hmap, ['matkgd', 'sotkgd', 'account', 'tk'], 5)
idxTVKD = resolve_col_idx(hmap, ['mathanhvien', 'matvkd', 'tvkd', 'member'], 21)
idxHD = resolve_col_idx(hmap, ['mahd', 'mahopdong', 'symbol', 'contract'], 6)
idxMB = resolve_col_idx(hmap, ['muaban', 'side', 'buysell'], 7)
idxType = resolve_col_idx(hmap, ['loailenh', 'ordertype', 'type'], 8)
idxKL = resolve_col_idx(hmap, ['klkhop', 'khoiluongkhop', 'volume', 'qty', 'matchedvolume'], 10)
idxGia = resolve_col_idx(hmap, ['giakhoptrungbinh', 'giakhoptb', 'giakhop', 'price', 'avgprice'], 13)

print(f"  idxTKGD : Col {idxTKGD} -> '{headers[idxTKGD]}'")
print(f"  idxTVKD : Col {idxTVKD} -> '{headers[idxTVKD]}'")
print(f"  idxHD   : Col {idxHD} -> '{headers[idxHD]}'")
print(f"  idxMB   : Col {idxMB} -> '{headers[idxMB]}'")
print(f"  idxType : Col {idxType} -> '{headers[idxType]}'")
print(f"  idxKL   : Col {idxKL} -> '{headers[idxKL]}'")
print(f"  idxGia  : Col {idxGia} -> '{headers[idxGia]}'")

# Tính tổng số lot và kiểm tra phân loại
total_kl = df_dsgd[headers[idxKL]].sum()
print(f"\n=> TỔNG SỐ LOT DSGD CCP: {total_kl} lot (từ {len(df_dsgd)} dòng)")

# 2. TEST TTM CCP
ttm_file = os.path.join(CCP_DIR, "TTM CCP.xlsx")
df_ttm = pd.read_excel(ttm_file)
ttm_headers = list(df_ttm.columns)
ttm_hmap = build_ccp_header_map(ttm_headers)

print("\n2. KIỂM TRA MAPPING CỘT TTM CCP:")
idxTVKD_ttm = resolve_col_idx(ttm_hmap, ['mathanhvien', 'matvkd', 'tvkd', 'member'], 0)
idxTKGD_ttm = resolve_col_idx(ttm_hmap, ['matkgd', 'sotkgd', 'account', 'tk'], 3)
idxHD_ttm = resolve_col_idx(ttm_hmap, ['mahopdong', 'mahd', 'symbol', 'contract'], 5)
idxKLM_ttm = resolve_col_idx(ttm_hmap, ['khoiluongmua', 'klmua', 'buyvolume', 'buyqty'], 8)
idxKLB_ttm = resolve_col_idx(ttm_hmap, ['khoiluongban', 'klban', 'sellvolume', 'sellqty'], 9)
idxLL_ttm = resolve_col_idx(ttm_hmap, ['lailodukien', 'unrealizedpnl'], 13)
idxLLVnd_ttm = resolve_col_idx(ttm_hmap, ['lailodukienvnd', 'unrealizedpnlvnd'], 14)

print(f"  idxTVKD : Col {idxTVKD_ttm} -> '{ttm_headers[idxTVKD_ttm]}'")
print(f"  idxTKGD : Col {idxTKGD_ttm} -> '{ttm_headers[idxTKGD_ttm]}'")
print(f"  idxHD   : Col {idxHD_ttm} -> '{ttm_headers[idxHD_ttm]}'")
print(f"  idxKLM  : Col {idxKLM_ttm} -> '{ttm_headers[idxKLM_ttm]}'")
print(f"  idxKLB  : Col {idxKLB_ttm} -> '{ttm_headers[idxKLB_ttm]}'")
print(f"  idxLL   : Col {idxLL_ttm} -> '{ttm_headers[idxLL_ttm]}'")
print(f"  idxLLVnd: Col {idxLLVnd_ttm} -> '{ttm_headers[idxLLVnd_ttm]}'")

# 3. TEST TTTT CCP
tttt_file = os.path.join(CCP_DIR, "TTTT.xlsx")
df_tttt = pd.read_excel(tttt_file)
tttt_headers = list(df_tttt.columns)
tttt_hmap = build_ccp_header_map(tttt_headers)

print("\n3. KIỂM TRA MAPPING CỘT TTTT CCP:")
idxTVKD_tttt = resolve_col_idx(tttt_hmap, ['mathanhvien', 'matvkd', 'tvkd', 'member'], 0)
idxTKGD_tttt = resolve_col_idx(tttt_hmap, ['matkgd', 'sotkgd', 'account', 'tk'], 3)
idxHD_tttt = resolve_col_idx(tttt_hmap, ['mahopdong', 'mahd', 'symbol', 'contract'], 7)
idxLL_tttt = resolve_col_idx(tttt_hmap, ['lailothucte', 'realizedpnl'], 4)
idxLLVnd_tttt = resolve_col_idx(tttt_hmap, ['lailothuctevnd', 'realizedpnlvnd'], 5)
idxKLM_tttt = resolve_col_idx(tttt_hmap, ['khoiluongmua', 'klmua', 'buyvolume', 'buyqty'], 9)
idxKLB_tttt = resolve_col_idx(tttt_hmap, ['khoiluongban', 'klban', 'sellvolume', 'sellqty'], 10)

print(f"  idxTVKD : Col {idxTVKD_tttt} -> '{tttt_headers[idxTVKD_tttt]}'")
print(f"  idxTKGD : Col {idxTKGD_tttt} -> '{tttt_headers[idxTKGD_tttt]}'")
print(f"  idxHD   : Col {idxHD_tttt} -> '{tttt_headers[idxHD_tttt]}'")
print(f"  idxLL   : Col {idxLL_tttt} -> '{tttt_headers[idxLL_tttt]}'")
print(f"  idxLLVnd: Col {idxLLVnd_tttt} -> '{tttt_headers[idxLLVnd_tttt]}'")
print(f"  idxKLM  : Col {idxKLM_tttt} -> '{tttt_headers[idxKLM_tttt]}'")
print(f"  idxKLB  : Col {idxKLB_tttt} -> '{tttt_headers[idxKLB_tttt]}'")
