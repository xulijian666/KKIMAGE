@echo off
chcp 65001 >nul 2>&1
title KKIMAGE Build Tool
echo ========================================
echo   KKIMAGE Build Tool
echo ========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found
    pause
    exit /b 1
)

where cargo >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Rust not found. Install from https://rustup.rs
    pause
    exit /b 1
)

echo [1/2] Building Release version (first time may take a while)...
echo.
cd /d "%~dp0"
call npm run tauri build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)
echo.

echo ========================================
echo [2/2] Build complete!
echo ========================================
echo.
echo Output:
echo   NSIS: src-tauri\target\release\bundle\nsis\
echo   MSI:  src-tauri\target\release\bundle\msi\
echo   EXE:  src-tauri\target\release\KKIMAGE.exe
echo.

explorer src-tauri\target\release\bundle\nsis

pause
