@echo off
echo =========================================================
echo  MICC - Sync Pending Equipments
echo =========================================================
echo.
echo Extracting data from Pending Equipments.xlsx...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0extract_data.ps1" -TargetFile "Pending"
echo.
echo Complete!
echo.
pause
