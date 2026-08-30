# Mercicat v2 Windows build

## Packaging

The desktop target builds the Vite client, bundles the Socket.IO server into `dist-electron/server.cjs`, and packages both with Electron Builder. The Electron main process starts the bundled server with `fork(..., { silent: true })` before opening the client HTML; the client connects to `http://localhost:3001` and joins the default two-player room.

Build command:

```text
pnpm desktop:build
```

The intended artifact is `/home/alfr/iPhoneDrop/Mercicat/mercicat-v2-windows.exe`.

## Verification status

This Linux workspace currently has neither `electron` nor `electron-builder` installed. Installing the required build dependencies was blocked by the execution environment, so no Windows executable was produced in this run. The packaging integration is ready for a machine with those tools installed.
