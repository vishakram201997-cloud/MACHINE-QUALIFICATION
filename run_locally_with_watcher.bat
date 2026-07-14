@echo off
title Machine Installation Control Center - Local Server
echo =========================================================
echo  Machine Installation Control Center - Local Services
echo =========================================================
echo.

echo Checking if local server is running...
netstat -ano | findstr :8000 >nul
if %errorlevel% neq 0 (
    echo Starting local web server (server.ps1)...
    start powershell -NoExit -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
    timeout /t 3 >nul
) else (
    echo Local web server is already running!
)

echo.
echo Checking if Excel file watcher is running...
tasklist /v | findstr /i "MICC File Watcher" >nul
if %errorlevel% neq 0 (
    echo Starting Excel file watcher (watch_data.ps1)...
    start "MICC File Watcher" powershell -NoExit -NoProfile -ExecutionPolicy Bypass -File "%~dp0watch_data.ps1"
) else (
    echo Excel file watcher is already running!
)

echo.
echo Opening Control Center page in default browser...
start http://127.0.0.1:8000/index.html

echo.
echo =========================================================
echo  Local Services Running!
echo =========================================================
echo  Any changes saved to Milestones, Pending Equipments,
echo  or Manpower sheets will automatically update the page.
echo =========================================================
echo.
pause
