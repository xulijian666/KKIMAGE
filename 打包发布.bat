@echo off
chcp 65001 >nul
title KKIMAGE 打包发布
echo.
echo  ╔══════════════════════════════════════╗
echo  ║        KKIMAGE 打包发布              ║
echo  ╚══════════════════════════════════════╝
echo.
echo  正在构建 Release 版本...
echo  首次打包需要编译 Rust，请耐心等待
echo.
cd /d "%~dp0"
call npm run tauri build
echo.
echo  ══════════════════════════════════════
echo  打包完成！
echo  安装包位置: src-tauri\target\release\bundle
echo  ══════════════════════════════════════
echo.
pause
