@echo off
title KKIMAGE Dev Mode
echo.
echo  ========================================
echo        KKIMAGE Dev Mode Starting
echo  ========================================
echo.
echo  Frontend: http://localhost:16889
echo  Hot Reload: auto-refresh on code change
echo  Press Ctrl+C to stop
echo.
cd /d "%~dp0"
call npm run tauri dev
pause
