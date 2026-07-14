@echo off
echo =========================================================
echo  MICC - Sync MEP Readiness
echo =========================================================
echo.
echo Extracting data from MEP readiness file 09052026.xlsx...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0extract_data.ps1" -TargetFile "MEP"
echo.
echo Complete!
echo.
pause
