#!/usr/bin/env pwsh
# Mercicat v2 - Windows Build Script

Write-Host ""
Write-Host "========================================"
Write-Host "Mercicat v2 - Windows Build"
Write-Host "========================================"
Write-Host ""

# Check Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "X Node.js is not installed or not in PATH"
    Write-Host ""
    Write-Host "Please install Node.js from https://nodejs.org/"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "+ Node.js found"
& node --version
Write-Host ""

# Check pnpm
$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) {
    Write-Host "Installing pnpm..."
    & npm install -g pnpm
    if ($LASTEXITCODE -ne 0) {
        Write-Host "X Failed to install pnpm"
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host "+ pnpm found"
& pnpm --version
Write-Host ""

Write-Host "Installing dependencies..."
& pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) {
    Write-Host "X pnpm install failed"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Building application..."
& pnpm run dist:win
if ($LASTEXITCODE -ne 0) {
    Write-Host "X Build failed"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "========================================"
Write-Host "+ Build complete!"
Write-Host "========================================"
Write-Host ""
Write-Host "Your Mercicat installer is ready at:"
Write-Host "  release\mercicat-v2-windows.exe"
Write-Host ""
Read-Host "Press Enter to exit"
