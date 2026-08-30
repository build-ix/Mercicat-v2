import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const distElectron = path.join(root, "dist-electron");

console.log("📦 Staging Electron app...");

// Create dist-electron directory
await mkdir(distElectron, { recursive: true });

// Copy electron main
await cp(
  path.join(root, "electron-main.cjs"),
  path.join(distElectron, "electron-main.cjs")
);

// Bundle server with Vite into server.cjs
// (Server TypeScript is already built by pnpm build)
console.log("🔨 Bundling server with Vite...");
try {
  execSync(
    `npx vite build --config apps/client/vite.server.config.mjs`,
    {
      cwd: root,
      stdio: "inherit",
    }
  );
} catch (e) {
  console.error("Server bundle failed:", e.message);
  process.exit(1);
}

// Generate package.json for Electron app
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const electronPackageJson = {
  name: "mercicat-v2",
  version: packageJson.version,
  main: "electron-main.cjs",
};
await writeFile(
  path.join(distElectron, "package.json"),
  JSON.stringify(electronPackageJson, null, 2)
);

console.log("✅ Electron app staged at dist-electron/");
