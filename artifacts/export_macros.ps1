$outputPath = "c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-shift-checklist\artifacts\vba_code.txt"

Write-Host "Connecting to Excel..."
$excel = $null
$isNewInstance = $false

try {
    $excel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
    # Verify Workbooks collection is accessible
    if ($excel.Workbooks -eq $null) {
        throw "Workbooks collection is null."
    }
    Write-Host "Attached to running Excel instance successfully."
} catch {
    Write-Host "Could not attach to running Excel instance or it is unresponsive: $_"
    $excel = $null
}

if ($excel -eq $null) {
    Write-Host "Starting a new Excel instance..."
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $isNewInstance = $true
}

try {
    $targetName = "Marco Ghep file.CQG Desktop.xlsm"
    $wb = $null
    
    # Try to find target workbook in open workbooks
    if (-not $isNewInstance) {
        try {
            foreach ($w in $excel.Workbooks) {
                if ($w.Name -like "*$targetName*") {
                    $wb = $w
                    Write-Host "Found open workbook: $($w.Name) ($($w.FullName))"
                    break
                }
            }
        } catch {
            Write-Host "Could not query open workbooks list."
        }
    }
    
    if ($wb -eq $null) {
        $xlsmPath = "c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-shift-checklist\artifacts\copy.xlsm"
        Write-Host "Workbook not open. Opening copy: $xlsmPath"
        $wb = $excel.Workbooks.Open($xlsmPath)
    }
    
    if ($wb -eq $null) {
        Write-Error "Failed to open workbook."
        exit
    }
    
    Write-Host "Accessing VBProject..."
    $project = $wb.VBProject
    if ($project -eq $null) {
        Write-Error "VBProject is null."
        exit
    }
    
    Write-Host "VBProject accessed. Status: Name=$($project.Name)"
    
    $components = $project.VBComponents
    Write-Host "VBComponents count: $($components.Count)"
    
    $outString = ""
    
    foreach ($comp in $components) {
        Write-Host "Found component: $($comp.Name), Type: $($comp.Type)"
        $outString += "`n========================================`n"
        $outString += "Component Name: $($comp.Name), Type: $($comp.Type)`n"
        $outString += "========================================`n"
        
        $count = $comp.CodeModule.CountOfLines
        Write-Host "  Count of lines: $count"
        if ($count -gt 0) {
            $code = $comp.CodeModule.Lines(1, $count)
            $outString += $code
            $outString += "`n"
        } else {
            $outString += "No code lines.`n"
        }
    }
    
    [System.IO.File]::WriteAllText($outputPath, $outString)
    Write-Host "VBA Code exported successfully to $outputPath"
} catch {
    Write-Host "ERROR: $_ at line $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor Red
} finally {
    if ($wb -and $wb.FullName -like "*copy.xlsm*") {
        Write-Host "Closing the copy..."
        $wb.Close($false)
    }
    if ($isNewInstance -and $excel) {
        Write-Host "Quitting new Excel instance..."
        $excel.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    }
}
