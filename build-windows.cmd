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
  echo ❌ Node.js is not installed or not in PATH
  echo.
  echo Please install Node.js from https://nodejs.org/
  pause
  exit /b 1
)

echo ✓ Node.js found
node --version

REM Check if pnpm is available
where pnpm >nul 2>nul
if errorlevel 1 (
  echo.
  echo 🔨 Installing pnpm...
  call npm install -g pnpm
  if errorlevel 1 (
    echo ❌ Failed to install pnpm
    pause
    exit /b 1
  )
)

echo ✓ pnpm found
pnpm --version

echo.
echo 📦 Installing dependencies...
call pnpm install --frozen-lockfile
if errorlevel 1 (
  echo ❌ pnpm install failed
  pause
  exit /b 1
)

echo.
echo 🔨 Building application...
call pnpm run dist:win
if errorlevel 1 (
  echo ❌ Build failed
  pause
  exit /b 1
)

echo.
echo ========================================
echo ✅ Build complete!
echo ========================================
echo.
echo Your Mercicat installer is ready at:
echo   iPhoneDrop\Mercicat\
echo.
pause
