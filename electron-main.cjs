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
    webPreferences: { contextIsolation: true, sandbox: true },
  });

  const indexPath = path.join(__dirname, "..", "apps", "client", "dist", "index.html");
  await window.loadFile(indexPath);
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
