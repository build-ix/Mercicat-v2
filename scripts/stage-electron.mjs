import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
const root = process.cwd();
await mkdir("dist-electron", { recursive: true });
execFileSync(path.join(root, "apps/client/node_modules/.bin/vite"), ["build", "-c", path.join(root, "apps/client/vite.server.config.mjs")], { cwd: root, stdio: "inherit" });
await cp("electron-main.cjs", "dist-electron/electron-main.cjs");
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
await writeFile("dist-electron/package.json", JSON.stringify({ name: "mercicat-v2", version: packageJson.version, main: "electron-main.cjs" }, null, 2));
