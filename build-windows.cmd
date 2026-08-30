@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo Mercicat v2 - Windows Build
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
  echo X Node.js is not installed or not in PATH
  echo.
  echo Please install Node.js from https://nodejs.org/
  pause
  exit /b 1
)

echo + Node.js found
node --version
echo.

REM Check if pnpm is available
where pnpm >nul 2>nul
if errorlevel 1 (
  echo Installing pnpm...
  npm install -g pnpm
  if errorlevel 1 (
    echo X Failed to install pnpm
    pause
    exit /b 1
  )
)

echo + pnpm found
pnpm --version
echo.

echo Installing dependencies...
pnpm install --frozen-lockfile
if errorlevel 1 (
  echo X pnpm install failed
  pause
  exit /b 1
)

echo.
echo Building application...
pnpm run dist:win
if errorlevel 1 (
  echo X Build failed
  pause
  exit /b 1
)

echo.
echo ========================================
echo + Build complete!
echo ========================================
echo.
echo Your Mercicat installer is ready at:
echo   release\mercicat-v2-windows.exe
echo.
pause
