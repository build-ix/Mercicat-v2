const { app, BrowserWindow } = require("electron");
const { fork } = require("node:child_process");
const path = require("node:path");

let serverProcess;
function startServer() {
  const serverPath = path.join(__dirname, "server.cjs");
  serverProcess = fork(serverPath, [], {
    silent: false,
    env: { ...process.env, NODE_ENV: "production", PORT: "3001" },
  });
  serverProcess.on("error", (error) => console.error("Mercicat server failed:", error));
  serverProcess.on("exit", (code) => {
    if (code !== 0) console.error(`Server exited with code ${code}`);
  });
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: "#1a1a1e",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: undefined,
      nodeIntegration: false,
      enableRemoteModule: false,
    },
  });

  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
  let url;

  if (isDev) {
    // Development: load from dist directory
    const assetDir = path.join(__dirname, "apps", "client", "dist");
    const indexPath = path.join(assetDir, "index.html");
    url = `file://${indexPath}`;
    console.log("DEV: Loading from", indexPath);
  } else {
    // Production: assets are inside app.asar, use asar: protocol
    const indexPath = path.join(process.resourcesPath, "app.asar", "apps", "client", "dist", "index.html");
    url = `file://${indexPath}`;
    console.log("PROD: Loading from", indexPath);
  }

  console.log("URL:", url);
  await window.loadURL(url);
  window.once("ready-to-show", () => window.show());
}

app.whenReady().then(() => {
  startServer();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});
