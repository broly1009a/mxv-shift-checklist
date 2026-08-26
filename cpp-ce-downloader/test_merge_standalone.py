import os
import sys

# Append root directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.date_service import split_interval, merge_csv_files

def test_split_and_merge():
    print("=========================================================")
    print("TEST DOC LAP THUAT TOAN CHIA & GHEP FILE CSV")
    print("=========================================================")

    # 1. Test split_interval
    interval = {"start_str": "01/07/2026", "end_str": "31/07/2026", "mmyy": "0726"}
    parts = split_interval(interval["start_str"], interval["end_str"])
    print(f"\n1. Test split_interval('01/07/2026', '31/07/2026'):")
    if parts:
        p1, p2 = parts
        print(f"   [Nua 1]: {p1['start_str']} -> {p1['end_str']}")
        print(f"   [Nua 2]: {p2['start_str']} -> {p2['end_str']}")
    else:
        print("   [ERROR] Loi split_interval")

    # 2. Test merge_csv_files với 2 file tạm
    test_dir = os.path.join(os.path.dirname(__file__), "scratch")
    os.makedirs(test_dir, exist_ok=True)

    f1_path = os.path.join(test_dir, "temp_part1.csv")
    f2_path = os.path.join(test_dir, "temp_part2.csv")
    out_path = os.path.join(test_dir, "test_output_merged.csv")

    with open(f1_path, "w", encoding="utf-8-sig") as f:
        f.write("STT,Code,Acct,Volume\n")
        f.write("1,P001,001C123,10\n")
        f.write("2,P002,001C124,20\n")

    with open(f2_path, "w", encoding="utf-8-sig") as f:
        f.write("STT,Code,Acct,Volume\n")
        f.write("3,P003,001C125,15\n")
        f.write("4,P004,001C126,25\n")

    print(f"\n2. Test merge_csv_files(temp_part1, temp_part2) -> test_output_merged.csv:")
    ok = merge_csv_files([f1_path, f2_path], out_path)

    if ok and os.path.exists(out_path):
        with open(out_path, "r", encoding="utf-8-sig") as f:
            lines = f.readlines()
        print(f"   [SUCCESS] Hop nhat thanh cong! Kich thuoc: {os.path.getsize(out_path)} bytes, So dong: {len(lines)}")
        print("   File Content After Merge:")
        for idx, line in enumerate(lines, 1):
            print(f"     Line {idx}: {repr(line.strip())}")

        print(f"   [CHECK] Kiem tra don dep file tam: part1 exists={os.path.exists(f1_path)}, part2 exists={os.path.exists(f2_path)}")
    else:
        print("   [ERROR] Loi hop nhat file")

if __name__ == "__main__":
    test_split_and_merge()
