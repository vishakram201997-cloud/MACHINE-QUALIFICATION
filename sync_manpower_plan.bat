@echo off
echo =========================================================
echo  MICC - Sync Manpower Plan ^& Installation Plan
echo =========================================================
echo.
echo Extracting data from INSTALLATION PLAN MANPOWER 26-05-2026.xlsx...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0extract_data.ps1" -TargetFile "Manpower"
echo.
echo Complete!
echo.
pause
