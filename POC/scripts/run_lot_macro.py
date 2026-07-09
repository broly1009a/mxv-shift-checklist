import sys
import os
import time
import json
import threading
import win32com.client
import win32gui
import win32con

sys.stdout.reconfigure(encoding='utf-8')

captured_warnings = []
vba_runtime_errors = []
stop_event = threading.Event()

def msgbox_dismisser():
    """Background thread tự động đóng các dialog MsgBox/VBA Error từ Excel."""
    while not stop_event.is_set():
        time.sleep(0.2)

        # Đóng dialog Excel MsgBox
        excel_hwnd = win32gui.FindWindow("#32770", "Microsoft Excel")
        if excel_hwnd:
            text_lines = []
            def enum_excel_child(child, lparam):
                cls = win32gui.GetClassName(child)
                txt = win32gui.GetWindowText(child)
                if cls == "Static" and txt and txt not in ["OK", "Cancel", "Yes", "No"]:
                    text_lines.append(txt)
                return True
            try:
                win32gui.EnumChildWindows(excel_hwnd, enum_excel_child, None)
                msg_text = "\n".join(text_lines).strip()
                if msg_text and msg_text not in captured_warnings:
                    captured_warnings.append(msg_text)
                    print(f"[VBA WARNING] {msg_text}", flush=True)
            except Exception:
                pass
            try:
                ok_btn = win32gui.FindWindowEx(excel_hwnd, 0, "Button", "OK")
                if ok_btn:
                    win32gui.PostMessage(ok_btn, win32con.BM_CLICK, 0, 0)
                else:
                    win32gui.PostMessage(excel_hwnd, win32con.WM_COMMAND, 1, 0)
            except Exception:
                pass

        # Đóng dialog VBA Runtime Error
        vb_hwnd = win32gui.FindWindow("#32770", "Microsoft Visual Basic")
        if vb_hwnd:
            text_lines = []
            end_btn_hwnd = [0]
            def enum_vb_child(child, lparam):
                cls = win32gui.GetClassName(child)
                txt = win32gui.GetWindowText(child)
                if cls == "Static" and txt:
                    text_lines.append(txt)
                elif cls == "Button" and txt == "&End":
                    end_btn_hwnd[0] = child
                return True
            try:
                win32gui.EnumChildWindows(vb_hwnd, enum_vb_child, None)
                err_text = "\n".join(text_lines).strip()
                if err_text and err_text not in vba_runtime_errors:
                    vba_runtime_errors.append(err_text)
                    print(f"[VBA RUNTIME ERROR] {err_text}", flush=True)
            except Exception:
                pass
            if end_btn_hwnd[0]:
                try:
                    win32gui.PostMessage(end_btn_hwnd[0], win32con.BM_CLICK, 0, 0)
                except Exception:
                    pass


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Missing argument: macro_xlsm_path"}))
        sys.exit(1)

    macro_xlsm_path = sys.argv[1]

    if not os.path.exists(macro_xlsm_path):
        print(json.dumps({"success": False, "error": f"Macro file not found: {macro_xlsm_path}"}))
        sys.exit(1)

    # Khởi động thread tự động đóng dialog
    dismisser_thread = threading.Thread(target=msgbox_dismisser, daemon=True)
    dismisser_thread.start()

    excel = None
    wb = None
    try:
        print("Khởi động Excel...", flush=True)
        excel = win32com.client.Dispatch("Excel.Application")
        excel.Visible = False
        excel.DisplayAlerts = False

        print(f"Mở file macro: {macro_xlsm_path}", flush=True)
        wb = excel.Workbooks.Open(macro_xlsm_path, 0, False)

        # Chạy macro copyfile - macro tự lấy ngày và đường dẫn từ Sheet2
        macro_name = f"'{wb.Name}'!copyfile"
        print(f"Chạy macro: {macro_name}", flush=True)
        excel.Application.Run(macro_name)
        print("Macro hoàn tất!", flush=True)

        wb.Save()
        wb.Close(True)
        wb = None

        time.sleep(1)
        stop_event.set()

        if vba_runtime_errors:
            result = {"success": False, "error": f"VBA Runtime Error: {vba_runtime_errors[0]}", "warnings": captured_warnings}
        else:
            result = {"success": True, "warnings": captured_warnings, "message": "Macro chạy thành công."}
        print(json.dumps(result))

    except Exception as e:
        stop_event.set()
        err_msg = str(e)
        if vba_runtime_errors:
            err_msg = f"VBA Runtime Error: {vba_runtime_errors[0]}"
        result = {"success": False, "error": err_msg, "warnings": captured_warnings}
        print(json.dumps(result))
        if wb:
            try:
                wb.Close(False)
            except Exception:
                pass
    finally:
        if excel:
            try:
                excel.Quit()
            except Exception:
                pass


if __name__ == "__main__":
    main()
