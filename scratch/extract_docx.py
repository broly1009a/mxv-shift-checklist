import zipfile
import xml.etree.ElementTree as ET
import os

docx_path = r'c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-cqg-download-investigation\Checklist trực vận hành.docx'
out_path = r'c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-cqg-download-investigation\scratch\docx_extracted.txt'

os.makedirs(os.path.dirname(out_path), exist_ok=True)

with zipfile.ZipFile(docx_path) as z:
    xml_content = z.read('word/document.xml')

root = ET.fromstring(xml_content)
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

body = root.find('w:body', ns)
out_lines = []

for child in body:
    tag = child.tag.split('}')[-1]
    if tag == 'p':
        texts = [node.text for node in child.iter(f'{{{ns["w"]}}}t') if node.text]
        text = ''.join(texts).strip()
        if text:
            out_lines.append(text)
    elif tag == 'tbl':
        rows = []
        for tr in child.findall('w:tr', ns):
            row = []
            for tc in tr.findall('w:tc', ns):
                tc_texts = [node.text for node in tc.iter(f'{{{ns["w"]}}}t') if node.text]
                cell_text = ' '.join(''.join(tc_texts).split())
                row.append(cell_text)
            if row:
                rows.append(row)
        if rows:
            out_lines.append('\n--- TABLE ---')
            for r in rows:
                out_lines.append(' | '.join(r))
            out_lines.append('--- END TABLE ---\n')

with open(out_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out_lines))

print('Done extracting to', out_path, 'Lines:', len(out_lines))
