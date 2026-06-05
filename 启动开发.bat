@echo off
chcp 65001 >nul
title KKIMAGE 开发模式
echo.
echo  ╔══════════════════════════════════════╗
echo  ║        KKIMAGE 开发模式启动          ║
echo  ╚══════════════════════════════════════╝
echo.
echo  前端: http://localhost:16889
echo  热重载: 修改代码自动刷新
echo  按 Ctrl+C 停止
echo.
cd /d "%~dp0"
call npm run tauri dev
pause
