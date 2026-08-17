"""
gui.py — Giao diện người dùng (GUI) cho Tool Tải Báo Cáo CPP/CE (PyQt6)
Hỗ trợ chuyển đổi linh hoạt 2 chế độ:
  1. Chế độ Cơ bản (User Mode / Đơn giản): Ẩn URL, tài khoản và Log console đen. Hiển thị Thanh tiến trình & Nhãn trực quan.
  2. Chế độ Cấu hình Nâng cao (Technical Mode): Mở đầy đủ trường cấu hình hệ thống & Khung Log console chi tiết.
"""

import os
import sys
import re
from datetime import datetime
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QLineEdit, QPushButton, QFileDialog, QTextEdit,
    QCheckBox, QGroupBox, QMessageBox, QProgressBar
)
from PyQt6.QtCore import QThread, pyqtSignal, Qt
from downloader import run_download, load_config, save_config


class DownloadWorker(QThread):
    log_signal = pyqtSignal(str)
    finished_signal = pyqtSignal(bool)

    def __init__(self, system_url, username, password, start_date, end_date, output_dir, selected_reports, headless):
        super().__init__()
        self.system_url = system_url
        self.username = username
        self.password = password
        self.start_date = start_date
        self.end_date = end_date
        self.output_dir = output_dir
        self.selected_reports = selected_reports
        self.headless = headless

    def run(self):
        try:
            def handle_log(msg: str):
                self.log_signal.emit(msg)

            success = run_download(
                system_url=self.system_url,
                username=self.username,
                password=self.password,
                start_date=self.start_date,
                end_date=self.end_date,
                output_dir=self.output_dir,
                selected_reports=self.selected_reports,
                headless=self.headless,
                logger_callback=handle_log
            )
            self.finished_signal.emit(success if success is not None else False)
        except Exception as e:
            self.log_signal.emit(f"\n❌ Lỗi hệ thống ngoài dự kiến: {e}")
            self.finished_signal.emit(False)


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Tool Tải Báo Cáo Tự Động CPP & CE - MXV")
        self.resize(780, 680)

        self.cfg = load_config()
        self.is_tech_mode = self.cfg.get("gui_mode", "user") == "tech"
        self.current_report_name = ""
        self.downloaded_count = 0
        self.total_tasks = 1
        self.completed_tasks = 0

        self.init_ui()
        self.update_mode_ui()

    def init_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)

        # ── 0. Thanh tiêu đề & Nút chuyển đổi chế độ ─────────────────────────
        top_bar = QHBoxLayout()
        self.lbl_mode_title = QLabel("<b>TOOL TẢI BÁO CÁO CPP/CE THEO THÁNG</b>")
        self.lbl_mode_title.setStyleSheet("font-size: 15px; color: #1a2744;")
        top_bar.addWidget(self.lbl_mode_title)
        top_bar.addStretch()

        self.btn_toggle_mode = QPushButton()
        self.btn_toggle_mode.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_toggle_mode.clicked.connect(self.toggle_mode)
        top_bar.addWidget(self.btn_toggle_mode)

        main_layout.addLayout(top_bar)

        # ── 1. Cấu hình Tài khoản & Hệ thống (Ẩn ở Chế độ Cơ bản) ────────────
        self.group_auth = QGroupBox("Cấu hình Đăng nhập & Hệ thống (Nâng cao)")
        layout_auth = QVBoxLayout()

        # Dòng URL
        self.row_url_widget = QWidget()
        row_url_layout = QHBoxLayout(self.row_url_widget)
        row_url_layout.setContentsMargins(0, 0, 0, 0)
        row_url_layout.addWidget(QLabel("URL Hệ thống:"))
        self.txt_url = QLineEdit(self.cfg.get("system_url", "https://clearing.mxv.com.vn"))
        row_url_layout.addWidget(self.txt_url)
        layout_auth.addWidget(self.row_url_widget)

        row2 = QHBoxLayout()
        row2.addWidget(QLabel("Tên đăng nhập:"))
        self.txt_user = QLineEdit(self.cfg.get("username", ""))
        row2.addWidget(self.txt_user)

        row2.addWidget(QLabel("Mật khẩu:"))
        self.txt_pass = QLineEdit(self.cfg.get("password", ""))
        self.txt_pass.setEchoMode(QLineEdit.EchoMode.Password)
        row2.addWidget(self.txt_pass)

        layout_auth.addLayout(row2)
        self.group_auth.setLayout(layout_auth)
        main_layout.addWidget(self.group_auth)

        # ── 2. Khoảng thời gian & Thư mục xuất file ──────────────────────────
        group_params = QGroupBox("Khoảng thời gian xuất báo cáo (Theo tháng)")
        layout_params = QVBoxLayout()

        now = datetime.now()
        default_start = self.cfg.get("start_date", f"01/01/{now.year}")
        default_end = self.cfg.get("end_date", now.strftime("%d/%m/%Y"))

        row_dates = QHBoxLayout()
        row_dates.addWidget(QLabel("Từ ngày (dd/mm/yyyy):"))
        self.txt_start = QLineEdit(default_start)
        row_dates.addWidget(self.txt_start)

        row_dates.addWidget(QLabel("Đến ngày (dd/mm/yyyy):"))
        self.txt_end = QLineEdit(default_end)
        row_dates.addWidget(self.txt_end)

        row_dir = QHBoxLayout()
        row_dir.addWidget(QLabel("Thư mục lưu tổng:"))
        self.txt_output = QLineEdit(self.cfg.get("output_dir", r"D:\BaoCao_CPP_CE"))
        row_dir.addWidget(self.txt_output)

        btn_browse = QPushButton("Chọn Folder...")
        btn_browse.clicked.connect(self.browse_folder)
        row_dir.addWidget(btn_browse)

        layout_params.addLayout(row_dates)
        layout_params.addLayout(row_dir)
        group_params.setLayout(layout_params)
        main_layout.addWidget(group_params)

        # ── 3. Chọn Loại Báo Cáo ─────────────────────────────────────────────
        group_reports = QGroupBox("Danh sách báo cáo xuất CSV")
        layout_reports = QHBoxLayout()

        self.checkboxes = {}
        reports_list = self.cfg.get("reports", [])
        for r in reports_list:
            cb = QCheckBox(f"{r['name']} ({r['code']})")
            cb.setChecked(r.get("enabled", True))
            self.checkboxes[r['code']] = (cb, r)
            layout_reports.addWidget(cb)

        group_reports.setLayout(layout_reports)
        main_layout.addWidget(group_reports)

        # ── 4. Tùy chọn Ẩn Trình duyệt & Nút Chạy ──────────────────────────────
        row_action = QHBoxLayout()

        self.chk_headless_widget = QWidget()
        chk_layout = QHBoxLayout(self.chk_headless_widget)
        chk_layout.setContentsMargins(0, 0, 0, 0)
        self.chk_headless = QCheckBox("Chạy ẩn trình duyệt (Headless)")
        self.chk_headless.setChecked(self.cfg.get("headless", False))
        chk_layout.addWidget(self.chk_headless)
        row_action.addWidget(self.chk_headless_widget)

        self.btn_run = QPushButton("▶ BẮT ĐẦU TẢI BÁO CÁO")
        self.btn_run.setStyleSheet("font-weight: bold; background-color: #0d6efd; color: white; padding: 10px; font-size: 13px;")
        self.btn_run.clicked.connect(self.start_download)
        row_action.addWidget(self.btn_run)

        main_layout.addLayout(row_action)

        # ── 5. Trực quan hóa Tiến độ (Dành cho Chế độ Cơ bản) ──────────────────
        self.group_status = QGroupBox("Tiến độ tải báo cáo")
        status_layout = QVBoxLayout()

        self.lbl_status = QLabel("<b>Sẵn sàng tải báo cáo...</b>")
        self.lbl_status.setStyleSheet("font-size: 13px; color: #0d6efd; padding: 3px 0;")
        status_layout.addWidget(self.lbl_status)

        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)
        self.progress_bar.setStyleSheet("""
            QProgressBar {
                border: 1px solid #ced4da;
                border-radius: 4px;
                text-align: center;
                height: 22px;
                font-weight: bold;
            }
            QProgressBar::chunk {
                background-color: #198754;
            }
        """)
        status_layout.addWidget(self.progress_bar)

        self.lbl_summary = QLabel("Chưa có báo cáo nào được tải.")
        self.lbl_summary.setStyleSheet("font-size: 12px; color: #495057; font-style: italic;")
        status_layout.addWidget(self.lbl_summary)

        self.group_status.setLayout(status_layout)
        main_layout.addWidget(self.group_status)

        # ── 6. Log Output Console Đen (Chỉ hiện ở Chế độ Nâng cao) ───────────
        self.log_console = QTextEdit()
        self.log_console.setReadOnly(True)
        self.log_console.setStyleSheet("background-color: #1e1e1e; color: #00ff00; font-family: Consolas;")
        main_layout.addWidget(self.log_console)

    def toggle_mode(self):
        """Chuyển đổi qua lại giữa Chế độ Cơ bản và Chế độ Cấu hình Nâng cao"""
        self.is_tech_mode = not self.is_tech_mode
        self.cfg["gui_mode"] = "tech" if self.is_tech_mode else "user"
        save_config(self.cfg)
        self.update_mode_ui()

    def update_mode_ui(self):
        """Cập nhật trạng thái hiển thị của các widget theo chế độ"""
        if self.is_tech_mode:
            self.btn_toggle_mode.setText("👤 Chế độ: Cấu hình Nâng cao (Bấm để thu gọn)")
            self.btn_toggle_mode.setStyleSheet("background-color: #ffc107; color: #000; font-weight: bold; padding: 5px 10px;")
            self.group_auth.show()
            self.chk_headless_widget.show()
            self.log_console.show()
        else:
            self.btn_toggle_mode.setText("⚙️ Chế độ: Cơ bản (Bấm để mở Cấu hình Nâng cao)")
            self.btn_toggle_mode.setStyleSheet("background-color: #198754; color: #fff; font-weight: bold; padding: 5px 10px;")
            self.group_auth.hide()
            self.chk_headless_widget.hide()
            self.log_console.hide()

    def browse_folder(self):
        folder = QFileDialog.getExistingDirectory(self, "Chọn thư mục lưu file", self.txt_output.text())
        if folder:
            self.txt_output.setText(folder)

    def append_log(self, text: str):
        # 1. Ghi log kỹ thuật vào console (để sẵn khi chuyển sang chế độ nâng cao)
        self.log_console.append(text)

        # 2. Cập nhật nhãn & thanh tiến trình trực quan cho người xem
        if "BÁO CÁO:" in text:
            match = re.search(r"BÁO CÁO:\s*([^<]+)", text)
            if match:
                self.current_report_name = match.group(1).strip()
                self.lbl_status.setText(f"<b>📂 Đang chuyển sang báo cáo: {self.current_report_name}</b>")

        elif "[⏳ Đang tải]" in text:
            self.completed_tasks += 1
            if self.total_tasks > 0:
                pct = int((self.completed_tasks / self.total_tasks) * 100)
                self.progress_bar.setValue(min(pct, 95))
            
            clean_msg = text.replace("[⏳ Đang tải]", "").strip()
            self.lbl_status.setText(f"⏳ Đang tiến hành tải: <b>{clean_msg}</b>")

        elif "🎉 [Thành công]" in text:
            self.downloaded_count += 1
            match = re.search(r"Đã lưu file:\s*(.+)", text)
            filename = os.path.basename(match.group(1).strip()) if match else "file CSV"
            self.lbl_summary.setText(f"✅ Đã tải & lưu thành công: <b>{filename}</b> (Đã tải tổng cộng: {self.downloaded_count} file CSV)")

        elif "HOÀN THÀNH" in text:
            self.progress_bar.setValue(100)
            self.lbl_status.setText("<b>🎉 HOÀN THÀNH TOÀN BỘ TIẾN TRÌNH TẢI BÁO CÁO!</b>")

    def start_download(self):
        url = self.txt_url.text().strip() or self.cfg.get("system_url", "https://clearing.mxv.com.vn")
        user = self.txt_user.text().strip() or self.cfg.get("username", "")
        pwd = self.txt_pass.text().strip() or self.cfg.get("password", "")
        start_d = self.txt_start.text().strip()
        end_d = self.txt_end.text().strip()
        output_d = self.txt_output.text().strip()

        if not user or not pwd:
            QMessageBox.warning(self, "Cảnh báo", "Chưa có thông tin Đăng nhập! Hệ thống sẽ mở Chế độ Cấu hình Nâng cao để bạn điền Tên đăng nhập và Mật khẩu.")
            self.is_tech_mode = True
            self.update_mode_ui()
            return

        selected_reports = []
        for code, (cb, r_data) in self.checkboxes.items():
            if cb.isChecked():
                r_copy = dict(r_data)
                r_copy["enabled"] = True
                selected_reports.append(r_copy)

        if not selected_reports:
            QMessageBox.warning(self, "Cảnh báo", "Vui lòng chọn ít nhất 1 loại báo cáo!")
            return

        # Lưu cấu hình
        self.cfg["system_url"] = url
        self.cfg["username"] = user
        self.cfg["password"] = pwd
        self.cfg["start_date"] = start_d
        self.cfg["end_date"] = end_d
        self.cfg["output_dir"] = output_d
        self.cfg["headless"] = self.chk_headless.isChecked()
        save_config(self.cfg)

        # Reset các chỉ số tiến trình
        self.downloaded_count = 0
        self.completed_tasks = 0
        from downloader import generate_monthly_intervals
        intervals = generate_monthly_intervals(start_d, end_d)
        self.total_tasks = max(len(selected_reports) * len(intervals), 1)

        self.progress_bar.setValue(0)
        self.lbl_status.setText("<b>🌐 Đang kết nối hệ thống và đăng nhập...</b>")
        self.lbl_summary.setText("Đang khởi tạo trình duyệt...")

        self.btn_run.setEnabled(False)
        self.log_console.clear()

        self.worker = DownloadWorker(
            system_url=url,
            username=user,
            password=pwd,
            start_date=start_d,
            end_date=end_d,
            output_dir=output_d,
            selected_reports=selected_reports,
            headless=self.chk_headless.isChecked()
        )
        self.worker.log_signal.connect(self.append_log)
        self.worker.finished_signal.connect(self.on_download_finished)
        self.worker.start()

    def on_download_finished(self, success: bool):
        self.btn_run.setEnabled(True)
        if success:
            output_dir = self.txt_output.text().strip()
            self.lbl_status.setText("<b>🎉 TẢI HOÀN TẤT TẤT CẢ BÁO CÁO!</b>")
            QMessageBox.information(self, "Thông báo", f"Tải hoàn tất tất cả báo cáo!\nCác file CSV đã được lưu tại thư mục:\n{output_dir}")
            try:
                if os.path.exists(output_dir):
                    os.startfile(output_dir)
            except Exception:
                pass
        else:
            QMessageBox.critical(self, "Lỗi", "Có lỗi xảy ra trong quá trình tải báo cáo!")


def launch_gui():
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    launch_gui()
