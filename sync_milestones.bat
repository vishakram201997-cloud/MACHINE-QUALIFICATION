@echo off
echo =========================================================
echo  MICC - Sync Milestones ^& Summaries
echo =========================================================
echo.
echo Extracting data from Milestones.xlsx...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0extract_data.ps1" -TargetFile "Milestones"
echo.
echo Complete!
echo.
pause
