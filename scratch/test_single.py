import subprocess
import json

cmd = [
    "python",
    r"backend\src\scripts\python\ccp_adhoc_template_writer.py",
    "--template-path", r"M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Thong ke ccp\output\Thong ke gia tri giao dich 2026.xlsx",
    "--output-path", r"scratch\test_gtgd_debug.xlsx",
    "--date-label", "01/10/2026 - 21/10/2026",
    "--target-month", "T09.2026",
    "--data-json", json.dumps({"reportType": "GTGD"})
]
res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
print('Return code:', res.returncode)
print('STDOUT:\n', res.stdout)
if res.stderr:
    print('STDERR:\n', res.stderr)
