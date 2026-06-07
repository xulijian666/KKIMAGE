@echo off
chcp 65001 >nul
title KKIMAGE 依赖安装
echo.
echo  ╔══════════════════════════════════════╗
echo  ║        KKIMAGE 依赖安装              ║
echo  ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: 检查 Node.js
echo  [1/3] 检查 Node.js ...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ✗ 未检测到 Node.js，请先安装 Node.js ^(https://nodejs.org^)
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo  ✓ Node.js %%v

:: 检查 Rust
echo  [2/3] 检查 Rust ...
rustc --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ✗ 未检测到 Rust，请先安装 Rust ^(https://rustup.rs^)
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('rustc --version') do echo  ✓ Rust %%v

:: 安装 npm 依赖
echo  [3/3] 安装 npm 依赖 ...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo  ✗ npm 依赖安装失败
    pause
    exit /b 1
)

echo.
echo  ══════════════════════════════════════
echo   依赖安装完成！
echo   现在可以运行 启动开发.bat 进入开发模式
echo  ══════════════════════════════════════
echo.
pause
