# -*- coding: utf-8 -*-

def fix_cqg_merger():
    path = 'backend/src/modules/trading-ops/services/merger/cqg-merger.service.ts'
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for i, l in enumerate(lines):
        if 'const cqgNotice = isMatched' in l:
            lines[i+1] = "      ? `Khớp số dư CQG ngày ${day}/${month}: M-System và CQG`\n"
            lines[i+2] = "      : `Lệch số dư CQG ngày ${day}/${month}: ${totalMismatched} tài khoản (> $100)`;\n"
            break
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.writelines(lines)
    print("Fixed cqg-merger.service.ts")

def fix_ccp_eod():
    path = 'backend/src/modules/trading-ops/services/recon/ccp-eod.service.ts'
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for i, l in enumerate(lines):
        if 'const eodMessage = isEodClean' in l:
            lines[i+1] = "      ? `Khớp EOD CoreCCP phiên ${dateFormatted} (${totalAccounts} tài khoản)`\n"
            lines[i+2] = "      : `Cảnh báo EOD CoreCCP phiên ${dateFormatted}: ${mismatchedCcp.length} TK lệch, ${newNegativeIMRAcc.length} TK âm mới`;\n"
            break
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.writelines(lines)
    print("Fixed ccp-eod.service.ts")

if __name__ == '__main__':
    fix_cqg_merger()
    fix_ccp_eod()

