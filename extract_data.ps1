param(
    [string]$TargetFile = "All"
)

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

function Get-SheetData($workbook, $sheetName, $startRow, $headerRow, $maxCols) {
    try {
        $sheet = $workbook.Sheets.Item($sheetName)
    } catch {
        Write-Output "Sheet $sheetName not found"
        return $null
    }
    if (-not $sheet) { return $null }
    
    $rowsCount = $sheet.UsedRange.Rows.Count
    if ($rowsCount -lt $startRow) { return @() }
    
    $headers = @()
    $headerCounts = @{}
    for ($c = 1; $c -le $maxCols; $c++) {
        $val = $sheet.Cells.Item($headerRow, $c).Text
        if (-not $val) {
            $h = "Column_$c"
        } else {
            $h = $val.Trim()
        }
        $lowerH = $h.ToLower()
        if ($headerCounts.ContainsKey($lowerH)) {
            $headerCounts[$lowerH] += 1
            $h = "${h}_$($headerCounts[$lowerH])"
        } else {
            $headerCounts[$lowerH] = 1
        }
        $headers += $h
    }
    
    $data = @()
    for ($r = $startRow; $r -le $rowsCount; $r++) {
        $rowObj = [ordered]@{}
        $hasData = $false
        for ($c = 1; $c -le $maxCols; $c++) {
            $val = $sheet.Cells.Item($r, $c).Text
            if ($val) { $hasData = $true }
            $header = $headers[$c - 1]
            $rowObj[$header] = $val.Trim()
        }
        if ($hasData) {
            $data += $rowObj
        }
    }
    return $data
}

$jsonPath = "d:\Anti gravity project 1\extracted_data.json"
$data = [ordered]@{}

# If partial sync is requested, load existing data from JSON if it exists
if ($TargetFile -ine "All") {
    if (Test-Path $jsonPath) {
        Write-Output "Loading existing data from extracted_data.json..."
        try {
            $existingJson = Get-Content -Raw -Path $jsonPath -Encoding utf8
            $existingData = ConvertFrom-Json -InputObject $existingJson
            foreach ($prop in $existingData.PSObject.Properties) {
                $data[$prop.Name] = $prop.Value
            }
        } catch {
            Write-Output "Warning: Could not parse existing extracted_data.json. Starting fresh."
        }
    } else {
        Write-Output "No existing extracted_data.json found. Starting fresh."
    }
}

# 1. Read Manpower & Installation Plan
if ($TargetFile -ieq "All" -or $TargetFile -ieq "Manpower") {
    Write-Output "Extracting Manpower Plan..."
    try {
        $wb1 = $excel.Workbooks.Open("d:\Anti gravity project 1\INSTALLATION PLAN MANPOWER 26-05-2026.xlsx", 0, $true)
        $data["ManpowerPlan"] = Get-SheetData $wb1 "Sheet1" 2 1 14
        $data["ManpowerSummary"] = Get-SheetData $wb1 "Sheet5" 4 3 9
        $data["ManpowerPlanning"] = Get-SheetData $wb1 "Manpower planning" 2 1 17
        $wb1.Close($false)
    } catch {
        Write-Output "Error extracting Manpower Plan: $_"
    }
}

# 2. Read Pending Equipments
if ($TargetFile -ieq "All" -or $TargetFile -ieq "Pending") {
    Write-Output "Extracting Pending Equipments..."
    try {
        $wb2 = $excel.Workbooks.Open("d:\Anti gravity project 1\Pending Equipments.xlsx", 0, $true)
        $data["PendingEquipments"] = Get-SheetData $wb2 "Pending Equipments Details (2)" 2 1 12
        $wb2.Close($false)
    } catch {
        Write-Output "Error extracting Pending Equipments: $_"
    }
}

# 3. Read Milestones & Summaries
if ($TargetFile -ieq "All" -or $TargetFile -ieq "Milestones") {
    Write-Output "Extracting Milestones and Summaries..."
    try {
        $wb3 = $excel.Workbooks.Open("d:\Anti gravity project 1\Milestones.xlsx", 0, $true)
        $data["InstallationPlanBatch1"] = Get-SheetData $wb3 "Installation plan 1st batch" 2 1 12
        $data["FinalSummary"] = Get-SheetData $wb3 "Final summary" 2 1 7
        $wb3.Close($false)
    } catch {
        Write-Output "Error extracting Milestones: $_"
    }
}

# 4. Read MEP Readiness
if ($TargetFile -ieq "All" -or $TargetFile -ieq "MEP") {
    Write-Output "Extracting MEP Readiness..."
    try {
        $wb4 = $excel.Workbooks.Open("d:\Anti gravity project 1\MEP readiness file 09052026.xlsx", 0, $true)
        
        $targetSheet = $null
        $latestDate = [DateTime]::MinValue
        
        # Prioritize sheet '05-06-2026' as requested by the user
        foreach ($s in $wb4.Sheets) {
            $sName = $s.Name.Trim()
            if ($sName -eq "05-06-2026") {
                $targetSheet = $s
                break
            }
        }
        
        if ($targetSheet -eq $null) {
            foreach ($s in $wb4.Sheets) {
                $sName = $s.Name.Trim()
                if ($sName -match "^\d{2}-\d{2}-\d{4}$") {
                    try {
                        $parsedDate = [DateTime]::ParseExact($sName, "dd-MM-yyyy", $null)
                        if ($parsedDate -gt $latestDate) {
                            $latestDate = $parsedDate
                            $targetSheet = $s
                        }
                    } catch {}
                }
            }
        }
        
        if ($targetSheet -eq $null) {
            foreach ($s in $wb4.Sheets) {
                $cleanName = $s.Name.Trim()
                if ($cleanName -like "*2026*") {
                    $targetSheet = $s
                    break
                }
            }
        }
        
        if ($targetSheet -eq $null) {
            $targetSheet = $wb4.Sheets.Item(1)
        }
        
        Write-Output "Found target MEP sheet: $($targetSheet.Name)"
        
        $rowsCount = $targetSheet.UsedRange.Rows.Count
        $colsCount = $targetSheet.UsedRange.Columns.Count
        
        $headers = @()
        for ($c = 1; $c -le $colsCount; $c++) {
            $val = $targetSheet.Cells.Item(1, $c).Text.Trim()
            $val = $val -replace "\r?\n", " "
            if (-not $val) {
                $headers += "Col_$c"
            } else {
                $headers += $val
            }
        }
        
        $mepRows = @()
        for ($r = 2; $r -le $rowsCount; $r++) {
            $rowObj = [ordered]@{}
            $hasData = $false
            for ($c = 1; $c -le $colsCount; $c++) {
                $val = $targetSheet.Cells.Item($r, $c).Text.Trim()
                $val = $val -replace "\r?\n", " "
                if ($val) { $hasData = $true }
                $header = $headers[$c - 1]
                $rowObj[$header] = $val
            }
            if ($hasData) {
                $mepRows += $rowObj
            }
        }
        $data["MEPReadiness"] = $mepRows
        $wb4.Close($false)
    } catch {
        Write-Output "Error extracting MEP Readiness: $_"
    }
}

$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

# Convert to JSON with Depth and output directly as js variable & JSON file
$json = ConvertTo-Json -InputObject $data -Depth 10
$json | Out-File -FilePath "d:\Anti gravity project 1\extracted_data.json" -Encoding utf8

$jsContent = "const INSTALLATION_DATA = " + $json + ";"
$jsContent | Out-File -FilePath "d:\Anti gravity project 1\data.js" -Encoding utf8
Write-Output "Data extraction completed and saved to data.js & extracted_data.json!"
