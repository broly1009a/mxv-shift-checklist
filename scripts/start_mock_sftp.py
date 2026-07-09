import os
import sys
from pathlib import Path
from datetime import datetime
import paramiko
import sftpserver

def main():
    # 1. Setup mock directories
    root_dir = Path(__file__).resolve().parent
    sftp_root = root_dir / "mock_sftp_data"
    sftp_data_dir = sftp_root / "data"
    sftp_data_dir.mkdir(parents=True, exist_ok=True)

    # 2. Generate daily mock files with current date
    today = datetime.now()
    ddmmyyyy = today.strftime("%d%m%Y")
    yyyy_mm_dd = today.strftime("%Y-%m-%d")

    csv_name = f"EOD FO trades_PT Straits Financial Indonesia - 10017890000_{ddmmyyyy}.csv"
    xls_name = f"{yyyy_mm_dd}_10017890000.xls"

    csv_path = sftp_data_dir / csv_name
    xls_path = sftp_data_dir / xls_name

    # Write dummy content if files don't exist
    if not csv_path.exists():
        csv_path.write_text("Mock CSV EOD Trades Data\nLine 1\nLine 2", encoding="utf-8")
        print(f"Created mock file: {csv_path}")
    if not xls_path.exists():
        xls_path.write_text("Mock XLS EOD Summary Data\nDummy Excel Content", encoding="utf-8")
        print(f"Created mock file: {xls_path}")

    # 3. Generate RSA key file if not exists
    key_file = root_dir / "mock_sftp_rsa.key"
    if not key_file.exists():
        print("Generating RSA key file for mock SFTP server...")
        key = paramiko.RSAKey.generate(2048)
        key.write_private_key_file(str(key_file))
        print(f"RSA key file created at {key_file}")

    # 4. Change current working directory to sftp_root (so SFTP root '/' points here)
    os.chdir(sftp_root)
    sftpserver.StubSFTPServer.ROOT = str(sftp_root)
    print(f"SFTP root directory set to: {sftp_root}")
    print("Files in /data/ folder:")
    for f in sftp_data_dir.iterdir():
        print(f"  - {f.name}")

    # 5. Start the server
    host = "127.0.0.1"
    port = 2231
    print(f"Starting Mock SFTP Server at {host}:{port}...")
    print("Use credentials: Username: any / Password: any")
    print("Press Ctrl+C to stop the server.")

    try:
        sftpserver.start_server(host, port, str(key_file), "INFO")
    except KeyboardInterrupt:
        print("\nMock SFTP Server stopped.")

if __name__ == "__main__":
    main()
