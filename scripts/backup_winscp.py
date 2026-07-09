"""
backup_winscp.py — SFTP Backup using WinSCP.com via CMD
=========================================================
Implementation theo đúng chỉ đạo của Leader:
- Gọi thẳng WinSCP.com qua CMD (subprocess)
- Truyền tham số acc, pass, thư mục trực tiếp vào command
- Tự động lấy file trong 24h gần nhất
"""

import ctypes
import logging
import shutil
import subprocess
import sys
import winreg
from datetime import datetime
from pathlib import Path
import os


# ──────────────────────────────────────────────────────────────────────────────
# HELPER: Convert Unicode path → short path (8.3) để tránh lỗi encoding CMD
# ──────────────────────────────────────────────────────────────────────────────
def get_short_path(path: Path) -> str:
    """
    Convert duong dan co Unicode (tieng Viet, khoang trang, ...) sang 8.3 short path.
    Vi du: 'C:\\Downloads\\Gui backup' -> 'C:\\DOWNLO~1\\GUIBAC~1'

    FIX CASE 3: Neu o dia tat 8.3 (buf_size=0) va path co non-ASCII
    → tao thu muc du phong tai _ROOT/backup_ascii/ (toan ASCII, luon hoat dong).
    """
    path_str = str(path)

    # Thu GetShortPathNameW truoc
    buf_size = ctypes.windll.kernel32.GetShortPathNameW(path_str, None, 0)
    if buf_size > 0:
        buf = ctypes.create_unicode_buffer(buf_size)
        ctypes.windll.kernel32.GetShortPathNameW(path_str, buf, buf_size)
        return buf.value

    # 8.3 bi tat: kiem tra xem path co ky tu non-ASCII khong
    try:
        path_str.encode("ascii")
        return path_str  # Path thuần ASCII → dùng được bình thường
    except UnicodeEncodeError:
        # Path có Unicode + 8.3 bị tắt → dùng thư mục ASCII an toàn cạnh script
        _root = Path(__file__).resolve().parent.parent
        fallback = _root / "backup_ascii"
        fallback.mkdir(parents=True, exist_ok=True)
        return str(fallback)


# ──────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ──────────────────────────────────────────────────────────────────────────────
_ROOT = Path(__file__).resolve().parent.parent

BACKUP_DIR = _ROOT / "backup_level2"
LOG_DIR    = _ROOT / "logs"

# Cấu hình SFTP Server Thật (Sửa lại khi lên UAT)
SFTP_HOST       = "sftp.mxv.com.vn"   # Chỉ hostname, không kèm port
SFTP_PORT       = 2231                 # Port riêng biệt
SFTP_USER       = "testuser"
SFTP_PASS       = "Test@2o26"          # FIX CASE 1: password có @ hay ký tự đặc biệt OK
SFTP_REMOTE_DIR = "/data/"            # FIX CASE 2: path có space cũng OK (đã quote bên dưới)

# Cấu hình lọc định dạng, giới hạn kích thước và băng thông tải (Chống nghẽn băng thông hệ thống)
FILE_EXTENSIONS = ["dump", "log"]     # Định dạng file cần lấy (Ví dụ: ["dump", "log"] hoặc để trống [] để lấy mọi file)
MAX_FILE_SIZE   = ""                  # Đặt rỗng "" để KHÔNG bỏ qua file lớn (tải tất cả các file)
LIMIT_SPEED_KB  = 204800              # Giới hạn tốc độ tải tối đa (KB/s). Ví dụ: 204800 KB/s (~200 MB/s). Đặt 0 nếu không giới hạn.


# ──────────────────────────────────────────────────────────────────────────────
# HELPER: Tìm WinSCP.com tự động trên mọi máy
# ──────────────────────────────────────────────────────────────────────────────
def get_winscp_path():
    """
    Tim WinSCP.com theo 3 cach, tra ve (duong_dan, cach_tim_duoc).
    Neu khong tim thay, tra ve (None, None).
    """
    # --- Cach 1: Duong dan cai dat mac dinh pho bien ---
    standard_paths = [
        r"C:\Program Files (x86)\WinSCP\WinSCP.com",
        r"C:\Program Files\WinSCP\WinSCP.com",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "WinSCP" / "WinSCP.com",
    ]
    for p in standard_paths:
        if Path(p).exists():
            return str(p), f"[Cach 1 - Thu muc mac dinh] {p}"

    # --- Cach 2: Tim trong bien moi truong PATH ---
    found = shutil.which("WinSCP.com")
    if found:
        return found, f"[Cach 2 - Bien moi truong PATH] {found}"

    # --- Cach 3: Tra cuu Windows Registry ---
    reg_keys = [
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WinSCP"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\WinSCP"),
        (winreg.HKEY_CURRENT_USER,  r"SOFTWARE\WinSCP"),
    ]
    for hive, key_path in reg_keys:
        try:
            with winreg.OpenKey(hive, key_path) as key:
                install_dir, _ = winreg.QueryValueEx(key, "InstallPath")
                candidate = Path(install_dir) / "WinSCP.com"
                if candidate.exists():
                    return str(candidate), f"[Cach 3 - Windows Registry] HKEY\\{key_path} -> {candidate}"
        except (FileNotFoundError, OSError):
            continue

    return None, None


# ──────────────────────────────────────────────────────────────────────────────
# LOGGING SETUP
# ──────────────────────────────────────────────────────────────────────────────
def setup_logger(log_dir: Path) -> logging.Logger:
    log_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file  = log_dir / f"winscp_sync_{timestamp}.log"

    fmt = "[%(asctime)s] %(message)s"

    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setFormatter(logging.Formatter(fmt, datefmt="%Y-%m-%d %H:%M:%S"))

    # Console handler
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(logging.Formatter(fmt, datefmt="%Y-%m-%d %H:%M:%S"))

    logger = logging.getLogger("winscp_backup")
    logger.setLevel(logging.INFO)
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    return logger


# ──────────────────────────────────────────────────────────────────────────────
# MAIN EXECUTION
# ──────────────────────────────────────────────────────────────────────────────
def main():
    logger = setup_logger(LOG_DIR)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    logger.info("START - Chay Backup qua WinSCP CMD (Theo yeu cau Leader)")

    winscp_exe, winscp_method = get_winscp_path()
    if not winscp_exe:
        logger.error("Khong tim thay WinSCP.com tren may. Da thu:")
        logger.error("  - Cach 1: C:\\Program Files\\WinSCP, C:\\Program Files (x86)\\WinSCP, AppData\\Local")
        logger.error("  - Cach 2: Bien moi truong PATH")
        logger.error("  - Cach 3: Windows Registry (HKLM/HKCU\\SOFTWARE\\WinSCP)")
        logger.error("Vui long cai dat WinSCP: https://winscp.net/eng/download.php")
        return
    logger.info(f"Tim thay WinSCP: {winscp_method}")

    # ── FIX CASE 1 & 3: Xu ly duong dan local co Unicode / o dia tat 8.3 ──
    backup_dir_safe = get_short_path(BACKUP_DIR)
    if backup_dir_safe != str(BACKUP_DIR):
        logger.info(f"Duong dan local co Unicode -> da chuyen: {BACKUP_DIR} => {backup_dir_safe}")

    # ── Giai phap cho moi van de escape/quote ──
    # Viet script WinSCP ra file tam → WinSCP doc truc tiep, KHONG qua shell parsing
    # → Password co @ # : space → OK (WinSCP script doc raw)
    # → Path co Unicode/space → OK (da xu ly bang short path o tren)
    # → Filemask co >= → OK (WinSCP tu parse trong file script cua no)
    
    # Tránh lỗi "Selecting files using a path ending with slash is ambiguous"
    # Remote path cần dạng /path/* và Local path cần dạng C:\path\
    remote_src = f"{SFTP_REMOTE_DIR.rstrip('/')}/*"
    local_dest = f"{backup_dir_safe.rstrip('\\')}\\"

    # 1. Xây dựng bộ lọc filemask (Đuôi file, kích thước tối đa, thời gian sửa đổi)
    size_filter = f"<{MAX_FILE_SIZE}" if MAX_FILE_SIZE else ""
    if FILE_EXTENSIONS:
        # Ví dụ: "*.dump<200M>=1D;*.log<200M>=1D"
        filemask_parts = [f"*.{ext}{size_filter}>=1D" for ext in FILE_EXTENSIONS]
        filemask_str = ";".join(filemask_parts)
    else:
        # Ví dụ: "*<200M>=1D"
        filemask_str = f"*{size_filter}>=1D"

    # 2. Xây dựng lệnh get với giới hạn băng thông (tốc độ tải) nếu có
    get_switches = ["-neweronly"]
    if LIMIT_SPEED_KB > 0:
        get_switches.append(f"-speed={LIMIT_SPEED_KB}")
    get_switches.append(f'-filemask="{filemask_str}"')

    script_file = LOG_DIR / "winscp_temp.script"
    script_content = (
        # option batch abort : Tu dong abort neu gap loi, KHONG cho user nhap input
        # → Ngan WinSCP treo khi chay ngam qua subprocess
        "option batch abort\n"
        # option confirm off : Tat tat ca hop thoai xac nhan (ghi de file, v.v.)
        "option confirm off\n"
        f"open sftp://{SFTP_USER}:{SFTP_PASS}@{SFTP_HOST}:{SFTP_PORT}/ -hostkey=*\n"
        f'get {" ".join(get_switches)} "{remote_src}" "{local_dest}"\n'
        f"exit\n"
    )
    script_file.write_text(script_content, encoding="utf-8")

    # FIX: WinSCP yêu cầu tham số script dạng /script=file, không được tách rời làm 2 đối số độc lập
    winscp_command = [winscp_exe, f"/script={script_file}"]

    # Che password khi in ra log de bao mat
    safe_cmd_log = f"WinSCP.com /script [temp] open sftp://{SFTP_USER}:***@{SFTP_HOST}:{SFTP_PORT} ... get {' '.join(get_switches)}"
    logger.info(f"Thuc thi CMD  : {safe_cmd_log}")
    logger.info(f"Local dir     : {local_dest}")
    logger.info(f"Remote dir    : {remote_src}")

    # GỌI APP WINSCP QUA CMD (SUBPROCESS POPEN - LOG REAL-TIME)
    try:
        process = subprocess.Popen(
            winscp_command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,  # Gộp stderr vào stdout để log chung
            text=True,
            encoding="utf-8",
            errors="replace"
        )

        logger.info("WINSCP Output:")
        # Đọc output thời gian thực
        while True:
            line = process.stdout.readline()
            if not line and process.poll() is not None:
                break
            if line:
                line_str = line.strip()
                if line_str and not line_str.startswith("winscp>"):
                    logger.info(f"  > {line_str}")

        returncode = process.poll()
        if returncode != 0:
            logger.error(f"WINSCP LOI (Exit Code: {returncode})")
            sys.exit(returncode)
        else:
            logger.info("WINSCP DONE.")

    except Exception as e:
        logger.error(f"Loi khi goi CMD WinSCP: {e}")
        sys.exit(1)
    finally:
        # Xoa file script tam sau khi chay (chua password, khong nen de lai)
        if script_file.exists():
            script_file.unlink()

    logger.info("END - Hoan tat dong bo WinSCP.")


if __name__ == "__main__":
    main()
