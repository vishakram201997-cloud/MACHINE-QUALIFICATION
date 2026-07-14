@echo off
:MENU
cls
echo =========================================================
echo  Machine Installation Control Center - Data Sync Tool
echo =========================================================
echo.
echo  Please select an option to synchronize Excel data:
echo.
echo  [1] Sync All Sheets (Full Sync - May take longer)
echo  [2] Sync Manpower Plan ^& Installation Plan
echo  [3] Sync MEP Readiness
echo  [4] Sync Milestones ^& Summaries
echo  [5] Sync Pending Equipments
echo  [6] Exit
echo.
echo =========================================================
set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" goto SYNC_ALL
if "%choice%"=="2" goto SYNC_MANPOWER
if "%choice%"=="3" goto SYNC_MEP
if "%choice%"=="4" goto SYNC_MILESTONES
if "%choice%"=="5" goto SYNC_PENDING
if "%choice%"=="6" goto EXIT
echo Invalid choice, please try again.
timeout /t 2 >nul
goto MENU

:SYNC_ALL
echo.
echo Extracting data from ALL Excel worksheets...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0extract_data.ps1" -TargetFile "All"
goto COMPLETE

:SYNC_MANPOWER
echo.
echo Extracting Manpower Plan ^& Installation Plan...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0extract_data.ps1" -TargetFile "Manpower"
goto COMPLETE

:SYNC_MEP
echo.
echo Extracting MEP Readiness...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0extract_data.ps1" -TargetFile "MEP"
goto COMPLETE

:SYNC_MILESTONES
echo.
echo Extracting Milestones ^& Summaries...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0extract_data.ps1" -TargetFile "Milestones"
goto COMPLETE

:SYNC_PENDING
echo.
echo Extracting Pending Equipments...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0extract_data.ps1" -TargetFile "Pending"
goto COMPLETE

:COMPLETE
echo.
echo =========================================================
echo  Synchronization Complete!
echo =========================================================
echo.
pause
goto MENU

:EXIT
exit
