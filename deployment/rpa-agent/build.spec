# build.spec — PyInstaller configuration for MXV RPA Agent
# Run: pyinstaller build.spec --clean

from PyInstaller.utils.hooks import collect_all

block_cipher = None

# Collect winotify data files
datas_winotify, binaries_winotify, hiddenimports_winotify = collect_all('winotify')

a = Analysis(
    ['app/main.py'],
    pathex=['.', 'app'],
    binaries=binaries_winotify,
    datas=[
        ('app/assets', 'assets'),       # Icons
        ('config.json', '.'),            # Default config
        *datas_winotify,
    ],
    hiddenimports=[
        'PyQt6.QtCore',
        'PyQt6.QtGui',
        'PyQt6.QtWidgets',
        'win32api',
        'win32con',
        'win32gui',
        'win32com.client',
        'winreg',
        'winotify',
        *hiddenimports_winotify,
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy', 'pandas'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='MXVAgent',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,          # No console window (windowed tray app)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='app/assets/icon.ico',   # MXV logo as app icon
    onefile=True,                      # Single .exe file
)
