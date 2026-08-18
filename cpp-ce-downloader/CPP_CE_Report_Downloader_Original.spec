# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['backup_original_monolithic/gui_original.py'],
    pathex=[],
    binaries=[],
    datas=[('header-logo-icon.svg', '.'), ('header-logo-light.svg', '.'), ('config.json', '.'), ('backup_original_monolithic/downloader_original.py', '.')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='CPP_CE_Report_Downloader_Original',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
