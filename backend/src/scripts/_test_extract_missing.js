const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const pyCode = `
import fitz
import os, sys
sys.path.append("/opt/mxv-checklist/backend/src/scripts/python")
from tkgd_extractor_worker import extract_single_card, auto_split_composite_dual_card, extract_pdf_contract

base_dir = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem"

# Test 1: CCCD dạng PDF (Lê Ngọc Hải)
fp1 = os.path.join(base_dir, "2026-09-09", "046C0002904", "CCCD LÊ NGỌC HẢI.pdf")
if os.path.exists(fp1):
    doc = fitz.open(fp1)
    page = doc[0]
    pix = page.get_pixmap(dpi=300)
    img_path = "/tmp/test_hai_cccd.jpg"
    pix.save(img_path)
    print("=== TEST CASE 1: 046C0002904 (CCCD LÊ NGỌC HẢI.pdf) ===")
    front, back = auto_split_composite_dual_card(img_path)
    print("Auto-split Front:", front, "Back:", back)
    res = extract_single_card(front or img_path, back_path=back)
    print("KẾT QUẢ BÓC TÁCH:", res.get("soCCCD"), res.get("hoTen"), res.get("ngaySinh"), res.get("theGeneration"))

# Test 2: CCCD dạng PDF (Huỳnh Kim Ngà)
fp2 = os.path.join(base_dir, "2026-09-10", "046C0002915", "CCCD HUỲNH KIM NGÀ.pdf")
if os.path.exists(fp2):
    doc = fitz.open(fp2)
    page = doc[0]
    pix = page.get_pixmap(dpi=300)
    img_path = "/tmp/test_nga_cccd.jpg"
    pix.save(img_path)
    print("\\n=== TEST CASE 2: 046C0002915 (CCCD HUỲNH KIM NGÀ.pdf) ===")
    front, back = auto_split_composite_dual_card(img_path)
    print("Auto-split Front:", front, "Back:", back)
    res = extract_single_card(front or img_path, back_path=back)
    print("KẾT QUẢ BÓC TÁCH:", res.get("soCCCD"), res.get("hoTen"), res.get("ngaySinh"), res.get("theGeneration"))

# Test 3: HĐ + PL01 trang 2 (Lê Thị Loan)
fp3 = os.path.join(base_dir, "2026-09-10", "046C0002881", "HD + PL01 046C0002881.pdf")
if os.path.exists(fp3):
    print("\\n=== TEST CASE 3: 046C0002881 (HD + PL01 046C0002881.pdf) ===")
    res_hd = extract_pdf_contract(fp3)
    print("KẾT QUẢ BÓC TÁCH HĐ:", res_hd.get("soCanCuoc"), res_hd.get("hoTen"), res_hd.get("ngaySinh"))
`;

    sftp.writeFile('/opt/mxv-checklist/backend/_test_extract_missing.py', pyCode, (err2) => {
      if (err2) throw err2;
      conn.exec('python3 /opt/mxv-checklist/backend/_test_extract_missing.py && rm -f /opt/mxv-checklist/backend/_test_extract_missing.py', (err3, stream) => {
        if (err3) throw err3;
        let out = '';
        let errOut = '';
        stream.on('data', d => out += d.toString());
        stream.stderr.on('data', d => errOut += d.toString());
        stream.on('close', (code) => {
          console.log('EXIT CODE:', code);
          console.log(out);
          if (errOut) console.error(errOut);
          conn.end();
        });
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
