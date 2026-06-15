import zipfile
import xml.etree.ElementTree as ET

docx_path = r"c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\TradingMXV\Tai_Lieu_Thiet_Ke_He_Thong_Checklist_MongoDB.docx"
with zipfile.ZipFile(docx_path) as docx:
    xml_content = docx.read('word/document.xml')
    xml_str = xml_content.decode('utf-8')
    idx = xml_str.find("it_open_01")
    if idx != -1:
        snippet = xml_str[idx-200:idx+800]
        with open("snippet.txt", "w", encoding="utf-8") as f:
            f.write(snippet)
        print("Wrote snippet.txt")
    else:
        print("Not found")
