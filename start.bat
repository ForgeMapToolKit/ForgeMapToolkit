@echo off
title Map Tool Suite
echo ================================================
echo          MAP TOOL SUITE
echo ================================================
echo.
echo Starting application...
echo.

cd /d "%~dp0"
npm run electron:dev

if errorlevel 1 (
    echo.
    echo ================================================
    echo Error: Application failed to start
    echo ================================================
    echo.
    echo Make sure you have run: npm install
    echo.
    pause
)
