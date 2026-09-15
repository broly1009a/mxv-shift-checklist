import os
import glob
import zipfile
import fitz  # PyMuPDF

base_dir = "/opt/mxv-checklist/backend/data/audit_14_accounts"
print("Processing accounts in:", base_dir)

subdirs = [d for d in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, d))]

for code in sorted(subdirs):
    acc_path = os.path.join(base_dir, code)
    img_out = os.path.join(acc_path, "extracted_cccd")
    os.makedirs(img_out, exist_ok=True)
    print(f"\n=== Account: {code} ===")

    # 1. Check & unzip any zip files
    for zpath in glob.glob(os.path.join(acc_path, "*.zip")):
        print(f"  Unzipping: {os.path.basename(zpath)}")
        try:
            with zipfile.ZipFile(zpath, 'r') as zip_ref:
                zip_ref.extractall(img_out)
        except Exception as e:
            print("    Unzip error:", e)

    # 2. Check standalone images (jpg, png) already downloaded
    for f in os.listdir(acc_path):
        f_lower = f.lower()
        if f_lower.endswith(('.jpg', '.jpeg', '.png')) and not f_lower.startswith('image001') and not f_lower == 'image.png':
            src = os.path.join(acc_path, f)
            dst = os.path.join(img_out, f)
            if not os.path.exists(dst):
                with open(src, 'rb') as fr, open(dst, 'wb') as fw:
                    fw.write(fr.read())
            print(f"  Copied standalone image: {f}")

    # 3. Process PDF files (hop-dong-*.pdf or HĐMTK*.pdf)
    for ppath in glob.glob(os.path.join(acc_path, "*.pdf")):
        fname = os.path.basename(ppath)
        if "CONG VAN" in fname.upper() or "GIẢI TRÌNH" in fname.upper() or "DANH SÁCH" in fname.upper():
            continue
        print(f"  Inspecting PDF: {fname}")
        try:
            doc = fitz.open(ppath)
            total_pages = len(doc)
            print(f"    Total pages: {total_pages}")
            
            # Check last 3 pages for CCCD images or render last 2 pages
            pages_to_check = range(max(0, total_pages - 3), total_pages)
            for pno in pages_to_check:
                page = doc[pno]
                img_list = page.get_images(full=True)
                print(f"    Page {pno+1}: {len(img_list)} embedded images")
                
                # If page has embedded images, extract them
                img_idx = 0
                for img in img_list:
                    xref = img[0]
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]
                    # Filter out small icons/logos (< 10KB)
                    if len(image_bytes) > 20000:
                        out_name = f"{code}_p{pno+1}_img{img_idx}.{image_ext}"
                        out_file = os.path.join(img_out, out_name)
                        with open(out_file, "wb") as f:
                            f.write(image_bytes)
                        print(f"      Extracted embedded image: {out_name} ({len(image_bytes)//1024} KB)")
                        img_idx += 1
                
                # Also render the page to png if it's within the last 2 pages
                if pno >= total_pages - 2:
                    pix = page.get_pixmap(dpi=150)
                    page_out = os.path.join(img_out, f"{code}_rendered_page_{pno+1}.png")
                    pix.save(page_out)
                    print(f"      Rendered page {pno+1} to PNG: {os.path.basename(page_out)}")
        except Exception as e:
            print(f"    PDF error {fname}:", e)

    # Print summary of extracted files
    extracted = os.listdir(img_out)
    print(f"  -> Total extracted files: {len(extracted)}")
    for ef in extracted:
        size_kb = os.path.getsize(os.path.join(img_out, ef)) // 1024
        print(f"     * {ef} ({size_kb} KB)")
