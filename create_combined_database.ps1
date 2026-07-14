# create_combined_database.ps1
# Script to combine individual Excel sheets into a single MICC_Database.xlsx workbook.

$folder = "d:\Anti gravity project 1"
$targetPath = Join-Path $folder "MICC_Database.xlsx"

Write-Host "Initializing Excel..." -ForegroundColor Cyan
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

# Create target workbook
$targetWb = $excel.Workbooks.Add()
# We will delete the default sheets later

function Copy-Sheet($sourceFile, $sourceSheetName, $targetSheetName) {
    $sourcePath = Join-Path $folder $sourceFile
    if (-not (Test-Path $sourcePath)) {
        Write-Host "Source file not found: $sourceFile" -ForegroundColor Red
        return $false
    }
    
    try {
        Write-Host "Opening source file: $sourceFile..." -ForegroundColor Yellow
        $sourceWb = $excel.Workbooks.Open($sourcePath, 0, $true)
        
        # Try to find sheet
        $sourceSheet = $null
        if ($sourceSheetName -eq "MEP_LATEST") {
            # Find latest date sheet or sheet with 2026
            foreach ($s in $sourceWb.Sheets) {
                if ($s.Name.Trim() -eq "05-06-2026") {
                    $sourceSheet = $s
                    break
                }
            }
            if ($null -eq $sourceSheet) {
                foreach ($s in $sourceWb.Sheets) {
                    if ($s.Name.Trim() -match "^\d{2}-\d{2}-\d{4}$" -or $s.Name.Trim() -like "*2026*") {
                        $sourceSheet = $s
                        break
                    }
                }
            }
            if ($null -eq $sourceSheet) {
                $sourceSheet = $sourceWb.Sheets.Item(1)
            }
        } else {
            try {
                $sourceSheet = $sourceWb.Sheets.Item($sourceSheetName)
            } catch {}
        }
        
        if ($null -eq $sourceSheet) {
            Write-Host "Sheet '$sourceSheetName' not found in $sourceFile" -ForegroundColor Red
            $sourceWb.Close($false)
            return $false
        }
        
        Write-Host "Copying sheet '$($sourceSheet.Name)' to new workbook as '$targetSheetName'..." -ForegroundColor Green
        # Copy sheet before the first sheet of target workbook
        $sourceSheet.Copy($targetWb.Sheets.Item(1))
        
        # The copied sheet is now the first sheet. Let's rename it.
        $copiedSheet = $targetWb.Sheets.Item(1)
        $copiedSheet.Name = $targetSheetName
        
        $sourceWb.Close($false)
        return $true
    } catch {
        Write-Host "Error copying sheet: $_" -ForegroundColor Red
        if ($null -ne $sourceWb) { $sourceWb.Close($false) }
        return $false
    }
}

# Copy all sheets
$copiedCount = 0
if (Copy-Sheet "Milestones.xlsx" "Installation plan 1st batch" "InstallationPlanBatch1") { $copiedCount++ }
if (Copy-Sheet "Milestones.xlsx" "Final summary" "FinalSummary") { $copiedCount++ }
if (Copy-Sheet "INSTALLATION PLAN MANPOWER 26-05-2026.xlsx" "Sheet1" "ManpowerPlan") { $copiedCount++ }
if (Copy-Sheet "INSTALLATION PLAN MANPOWER 26-05-2026.xlsx" "Sheet5" "ManpowerSummary") { $copiedCount++ }
if (Copy-Sheet "INSTALLATION PLAN MANPOWER 26-05-2026.xlsx" "Manpower planning" "ManpowerPlanning") { $copiedCount++ }
if (Copy-Sheet "Pending Equipments.xlsx" "Pending Equipments Details (2)" "PendingEquipments") { $copiedCount++ }
if (Copy-Sheet "MEP readiness file 09052026.xlsx" "MEP_LATEST" "MEPReadiness") { $copiedCount++ }

if ($copiedCount -eq 0) {
    Write-Host "No sheets copied. Aborting." -ForegroundColor Red
    $targetWb.Close($false)
    $excel.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    exit 1
}

# Create WebpageOverrides sheet
Write-Host "Adding 'WebpageOverrides' sheet..." -ForegroundColor Yellow
$overridesSheet = $targetWb.Sheets.Add($targetWb.Sheets.Item(1))
$overridesSheet.Name = "WebpageOverrides"
$overridesSheet.Cells.Item(1, 1) = "Key"
$overridesSheet.Cells.Item(1, 2) = "Value"

# Delete default sheets added by Excel (e.g. Sheet1, Sheet2, Sheet3 if they are still there and blank)
Write-Host "Cleaning up workbook..." -ForegroundColor Yellow
$defaultSheets = @("Sheet1", "Sheet2", "Sheet3")
foreach ($sheetName in $defaultSheets) {
    try {
        $sheet = $targetWb.Sheets.Item($sheetName)
        # Check if it has no data and isn't our newly copied sheet
        if ($sheet.UsedRange.Count -le 1 -and $sheet.Cells.Item(1, 1).Text -eq "") {
            $sheet.Delete()
        }
    } catch {}
}

# Save new workbook
if (Test-Path $targetPath) {
    Remove-Item $targetPath -Force
}
$targetWb.SaveAs($targetPath)
$targetWb.Close($true)

Write-Host "Quitting Excel..." -ForegroundColor Cyan
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

Write-Host ""
Write-Host "=========================================================" -ForegroundColor Green
Write-Host " COMBINED DATABASE CREATED SUCCESSFULLY!" -ForegroundColor Green
Write-Host " File: $targetPath" -ForegroundColor Yellow
Write-Host " Next steps:" -ForegroundColor Green
Write-Host " 1. Upload this file to Google Drive." -ForegroundColor Green
Write-Host " 2. Open it with Google Sheets." -ForegroundColor Green
Write-Host " 3. Click 'File' > 'Save as Google Sheets'." -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
Write-Host ""
