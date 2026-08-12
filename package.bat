@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo  泺 - 应用时长监视器 打包脚本
echo ========================================
echo.

:: Set China mirrors for Electron downloads
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/

echo [1/2] Building project...
call npx electron-vite build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b %errorlevel%
)
echo Build successful!
echo.

echo [2/2] Packaging...
call npx electron-builder --win --config electron-builder.yml
if %errorlevel% neq 0 (
    echo Package failed!
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================
echo Package successful!
echo Output: dist\泺 Setup *.exe
echo ========================================
pause
