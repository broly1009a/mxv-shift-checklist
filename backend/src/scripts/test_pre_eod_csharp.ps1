# test_pre_eod_csharp.ps1
$ErrorActionPreference = 'Stop'

Write-Host "=== CHAY TRUC TIEP HAM CheckPreEOD CUA TOOL C# ===" -ForegroundColor Cyan

$toolDir = "C:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-cqg-download-investigation\tool-C#\operate-transaction-app\bin\Debug"
$exePath = Join-Path $toolDir "Operate-Transaction-System.exe"

# 1. Unblock va Nap dependencies
Get-ChildItem -Path $toolDir -Filter "*.dll" | Unblock-File -ErrorAction SilentlyContinue
Get-ChildItem -Path $toolDir -Filter "*.exe" | Unblock-File -ErrorAction SilentlyContinue

$epplus = Join-Path $toolDir "EPPlus.dll"
if (Test-Path $epplus) {
    [System.Reflection.Assembly]::LoadFrom($epplus) | Out-Null
}

$asm = [System.Reflection.Assembly]::LoadFrom($exePath)
Write-Host "Da nap Assembly C#: $($asm.GetName().Name)" -ForegroundColor Green

# 2. Khoi tao Services
$configServiceType = $asm.GetType("operate_transaction_server.Services.ConfigService")
$configService = [System.Activator]::CreateInstance([type]$configServiceType)

$checkingServiceType = $asm.GetType("Operate_Transaction_System.Services.TransactionCheckingService")
$checkingService = [System.Activator]::CreateInstance([type]$checkingServiceType, @($configService))
Write-Host "Da khoi tao TransactionCheckingService" -ForegroundColor Green

# 3. Chuan bi file du lieu ngay 25
$baseDir = "C:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Pictures\Dữ liệu chuẩn ngày 25"
$dsgdPath = Join-Path $baseDir "25.09 MS\DSGD.xlsx"
$ttttPath = Join-Path $baseDir "25.09 MS\TTTT.xlsx"
$acmPath = Join-Path $baseDir "25.09 ACM\EOD FO trades_PT Straits Financial Indonesia - 10017890000_25092026.csv"
$frPath = Join-Path $baseDir "25.09 CQG\FR.xlsx"
$psPath = Join-Path $baseDir "25.09 CQG\PS.xlsx"

$preEodFilesType = $asm.GetType("Operate_Transaction_System.Services.TransactionCheckingService+PreEODFiles")
$preEodFiles = [System.Activator]::CreateInstance([type]$preEodFilesType)

$preEodFiles.Dsgd = [System.IO.File]::ReadAllBytes($dsgdPath)
$preEodFiles.AcmTrades = [System.IO.File]::ReadAllBytes($acmPath)
$preEodFiles.CqgFr = [System.IO.File]::ReadAllBytes($frPath)
$preEodFiles.Tttt = [System.IO.File]::ReadAllBytes($ttttPath)
$preEodFiles.CqgPs = [System.IO.File]::ReadAllBytes($psPath)

$acmName = [System.IO.Path]::GetFileName($acmPath)
$tradingDate = [System.DateTime]::Parse("2026-09-28T00:00:00")

Write-Host "Dang thuc thi CheckPreEOD bang C#..." -ForegroundColor Yellow
$sw = [System.Diagnostics.Stopwatch]::StartNew()

$task = $checkingService.CheckPreEOD($preEodFiles, $acmName, $tradingDate, $null)
$res = $task.GetAwaiter().GetResult()
$sw.Stop()

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "KET QUA DOI CHIEU TU TOOL C# GOC (Thoi gian: $($sw.ElapsedMilliseconds) ms)" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "• Passed Status : $($res.Passed)"

Write-Host ""
Write-Host "--- 1. TONG HOP KHOI LUONG GIAO DICH (C#) ---"
Write-Host " [ACM / Tu Doanh]"
Write-Host "   - M-System MS (duoi A) : $($res.Totals.TotalACM_MS)"
Write-Host "   - ACM Straits (file CSV): $($res.Totals.TotalACM_Straits)"
Write-Host "   - Chenh lech ACM        : $($res.Totals.DifferACM)"

Write-Host " [CQG / Khach Hang Thuong]"
Write-Host "   - M-System MS (khac A) : $($res.Totals.TotalCQG_MS)"
Write-Host "   - CQG FR (tru ZWAZCE)  : $($res.Totals.TotalCQG_FR)"
Write-Host "   - Chenh lech CQG        : $($res.Totals.DifferCQG)"

Write-Host ""
Write-Host "--- 2. CHI TIET LENH LECH KHOP LENH (C#) ---"
Write-Host "• So luong lenh lech: $($res.MismatchedTrades.Count)"
if ($res.MismatchedTrades.Count -gt 0) {
    foreach ($t in $res.MismatchedTrades) {
        Write-Host "  - [$($t.Source)] TK: $($t.MaTKGD), HD: $($t.MaHD), Gia: $($t.GiaKhop), Qty: $($t.KlGiaoDich) : $($t.Reason)"
    }
} else {
    Write-Host "Khong co lenh lech nao giua MS va CQG!" -ForegroundColor Green
}

Write-Host ""
Write-Host "--- 3. CHI TIET LECH VI THE TAT TOAN NET (C#) ---"
Write-Host "• So vi the net lech: $($res.MismatchedPositions.Count)"
if ($res.MismatchedPositions.Count -gt 0) {
    foreach ($p in $res.MismatchedPositions) {
        Write-Host "  - TK: $($p.Account) | HD: $($p.Symbol) | MS: $($p.MsPosition) | CQG: $($p.CQGPosition) | Differ: $($p.Differ)"
    }
} else {
    Write-Host "Khong co lech vi the net!" -ForegroundColor Green
}
Write-Host "================================================================================" -ForegroundColor Cyan
