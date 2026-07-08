import win32com.client
import os

try:
    excel = win32com.client.Dispatch("Excel.Application")
    excel.Visible = False
    excel.DisplayAlerts = False
    
    xlsm_path = r"c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-shift-checklist\artifacts\copy.xlsm"
    print(f"Opening workbook: {xlsm_path}")
    wb = excel.Workbooks.Open(xlsm_path, ReadOnly=True)
    
    try:
        project = wb.VBProject
        print("Successfully accessed VBProject.")
        for comp in project.VBComponents:
            print(f"\nComponent Name: {comp.Name}, Type: {comp.Type}")
            # Type 1 = Standard Module, 2 = Class Module, 100 = Document (Sheet/ThisWorkbook)
            if comp.Type == 1 or comp.Type == 100:
                try:
                    count = comp.CodeModule.CountOfLines
                    if count > 0:
                        print(f"--- Code start ({count} lines) ---")
                        print(comp.CodeModule.Lines(1, count))
                        print("--- Code end ---")
                    else:
                        print("No code lines.")
                except Exception as ex:
                    print(f"Error reading code lines: {ex}")
    except Exception as e:
        print(f"Error accessing VBProject: {e}")
        print("Note: If 'Programmatic access to Visual Basic Project is not trusted', please enable it in Excel Options -> Trust Center -> Trust Center Settings -> Macro Settings -> 'Trust access to the VBA project object model'.")
        
    wb.Close(False)
    excel.Quit()
except Exception as e:
    print("General Excel COM Error:", e)
