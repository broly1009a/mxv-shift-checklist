import zipfile
import xml.etree.ElementTree as ET
import os

docx_path = r"c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\TradingMXV\Tai_Lieu_Thiet_Ke_He_Thong_Checklist_MongoDB.docx"
txt_output_path = r"c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\TradingMXV\Tai_Lieu_Thiet_Ke_He_Thong_Checklist_MongoDB_full.txt"

def extract_docx_text(path):
    if not os.path.exists(path):
        return f"File not found: {path}"
    
    try:
        with zipfile.ZipFile(path) as docx:
            xml_content = docx.read('word/document.xml')
            root = ET.fromstring(xml_content)
            
            # Namespaces
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            
            text_runs = []
            for paragraph in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
                para_text = []
                for run in paragraph.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
                    if run.text:
                        para_text.append(run.text)
                text_runs.append("".join(para_text))
            
            return "\n".join(text_runs)
    except Exception as e:
        return f"Error: {str(e)}"

full_text = extract_docx_text(docx_path)
with open(txt_output_path, "w", encoding="utf-8") as f:
    f.write(full_text)

print(f"Extracted {len(full_text)} characters.")
