# Mercicat v2 — One-Click Windows Build

## For Windows PC Users

### Download & Run

1. **Clone the repo:**
   ```cmd
   git clone https://github.com/build-ix/Mercicat-v2.git
   cd Mercicat-v2
   ```

2. **Run the build:**
   ```cmd
   build-windows.cmd
   ```

That's it. The script will:
- Verify Node.js is installed (install if needed)
- Install pnpm
- Download dependencies
- Compile TypeScript
- Bundle the app
- Generate the Windows installer at `iPhoneDrop\Mercicat\mercicat-v2-windows.exe`

The installer is ready to distribute or install locally.

---

## Architecture

**Stack:**
- **Frontend:** Three.js + Vite + TypeScript
- **Backend:** Node.js + Socket.IO + Deterministic Simulation
- **Packaging:** Electron + NSIS

**Build Pipeline:**
```
pnpm run build              # TypeScript compilation (--sort respects dependencies)
pnpm run package:electron   # Bundles server into dist-electron/
pnpm run dist:win          # Electron Builder → Windows NSIS installer
```

**Output:** `/iPhoneDrop/Mercicat/mercicat-v2-windows.exe` (standalone installer)

---

## Development

### Local dev (GMKtec):
```bash
pnpm dev          # Runs all packages in parallel (Vite + Node with ts-node)
```

### Build (Linux):
```bash
pnpm run build        # Compiles all TypeScript packages
```

### Full Windows build (Linux for testing):
```bash
pnpm run dist:win     # Builds everything + packages NSIS
```
(Wine signing will fail on Linux; succeeds on Windows.)

---

## Monorepo Structure

```
packages/
  shared/         # Shared types, RNG, serialization
  protocol/       # Network messages (Zod schemas)
  simulation/     # Deterministic game engine
  content/        # Game assets, metadata

apps/
  client/         # Three.js Electron renderer
  server/         # Node.js game server
```

All TypeScript packages compile to `dist/` with declarations. The root `build` script respects dependency order via `pnpm -r --sort`.

---

## Troubleshooting

**"pnpm not found"**
- `build-windows.cmd` installs it automatically via `npm install -g pnpm`

**"Node.js not found"**
- Install from https://nodejs.org/ or the script will guide you

**"Build failed"**
- Run `pnpm install --frozen-lockfile` to verify dependencies
- Check Node version: should be 18+
- Delete `node_modules` and `.pnpm-store` if stuck, then retry

**"Installer won't run"**
- Windows Defender may block unsigned .exe; add exception or sign with a cert
- Try running as Administrator

---

## Credits

Built with DeepSeek + Fable 5. Deterministic simulation architecture from Fable.
