@echo off
title Map Tool Suite - Installation
echo ================================================
echo     MAP TOOL SUITE - INSTALLATION
echo ================================================
echo.
echo This will install all required dependencies.
echo This may take 2-5 minutes.
echo.
pause

cd /d "%~dp0"

echo.
echo Installing dependencies...
echo.
call npm install

if errorlevel 1 (
    echo.
    echo ================================================
    echo Installation failed!
    echo ================================================
    echo.
    echo Please check:
    echo - Is Node.js installed? (https://nodejs.org/)
    echo - Is your internet connection working?
    echo.
    pause
    exit /b 1
)

echo.
echo ================================================
echo Installation completed successfully!
echo ================================================
echo.
echo Next steps:
echo 1. Run: npm run build
echo 2. Run: npm run electron:dev
echo.
echo Or simply double-click: start.bat
echo.
pause
