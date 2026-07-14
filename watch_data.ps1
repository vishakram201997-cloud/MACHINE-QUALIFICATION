# watch_data.ps1
# Background Excel File Watcher for Machine Installation Control Center (MICC)

$folder = "d:\Anti gravity project 1"
$filesToWatch = @(
    "Milestones.xlsx",
    "INSTALLATION PLAN MANPOWER 26-05-2026.xlsx",
    "Pending Equipments.xlsx",
    "MEP readiness file 09052026.xlsx"
)

# Debounce state to avoid multiple rapid executions
$global:watcherLastRunTime = [DateTime]::MinValue
$debouncePeriod = [TimeSpan]::FromSeconds(3)

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $folder
$watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::FileName -bor [System.IO.NotifyFilters]::CreationTime

$action = {
    $path = $Event.SourceEventArgs.FullPath
    $name = $Event.SourceEventArgs.Name
    
    # Check if the changed file is one of our target files
    $matched = $false
    foreach ($f in $filesToWatch) {
        if ($name -ieq $f) {
            $matched = $true
            break
        }
    }
    
    if ($matched) {
        # Check debouncing
        $now = [DateTime]::Now
        if (($now - $global:watcherLastRunTime) -lt $debouncePeriod) {
            return
        }
        $global:watcherLastRunTime = $now
        
        Write-Host "$(Get-Date -Format 'HH:mm:ss') - Change detected in: $name"
        Write-Host "Waiting 2.5 seconds for Excel to release file locks..."
        Start-Sleep -Milliseconds 2500
        
        $targetArg = "All"
        if ($name -ieq "INSTALLATION PLAN MANPOWER 26-05-2026.xlsx") { $targetArg = "Manpower" }
        elseif ($name -ieq "MEP readiness file 09052026.xlsx") { $targetArg = "MEP" }
        elseif ($name -ieq "Milestones.xlsx") { $targetArg = "Milestones" }
        elseif ($name -ieq "Pending Equipments.xlsx") { $targetArg = "Pending" }

        Write-Host "Running extract_data.ps1 for target: $targetArg..."
        try {
            $p = Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$folder\extract_data.ps1`" -TargetFile `"$targetArg`"" -NoNewWindow -Wait -PassThru
            if ($p.ExitCode -eq 0) {
                Write-Host "Data extraction successful!"
            } else {
                Write-Host "Data extraction failed with exit code $($p.ExitCode)"
            }
        } catch {
            Write-Host "Error running data sync: $_"
        }
        Write-Host "---------------------------------------------------------"
    }
}

# Register events
$handlers = @()
$handlers += Register-ObjectEvent $watcher "Changed" -Action $action
$handlers += Register-ObjectEvent $watcher "Created" -Action $action
$handlers += Register-ObjectEvent $watcher "Renamed" -Action $action

$watcher.EnableRaisingEvents = $true

Clear-Host
Write-Host "========================================================="
Write-Host "  MICC Excel File Watcher is active"
Write-Host "========================================================="
Write-Host " Watching files in: $folder"
Write-Host " - Milestones.xlsx"
Write-Host " - Pending Equipments.xlsx"
Write-Host " - INSTALLATION PLAN MANPOWER 26-05-2026.xlsx"
Write-Host "========================================================="
Write-Host "Watching... Press Ctrl+C to stop."
Write-Host ""

try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    # Cleanup handlers
    foreach ($h in $handlers) {
        Unregister-Event -SourceIdentifier $h.Name -ErrorAction SilentlyContinue
    }
    $watcher.Dispose()
    Write-Host "Watcher stopped."
}
