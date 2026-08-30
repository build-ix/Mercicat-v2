import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(appDir, "../..");

const alias = {
  "@mercicat/shared": path.join(root, "packages/shared/dist/index.js"),
  "@mercicat/content": path.join(root, "packages/content/dist/index.js"),
  "@mercicat/simulation": path.join(root, "packages/simulation/dist/index.js"),
  "@mercicat/protocol": path.join(root, "packages/protocol/dist/index.js"),
};

export default defineConfig({
  resolve: { alias },
  build: {
    ssr: path.join(root, "apps/server/dist/main.js"),
    outDir: path.join(root, "dist-electron"),
    emptyOutDir: false,
    rollupOptions: {
      external: ["bufferutil", "utf-8-validate"],
      output: {
        entryFileNames: "server.cjs",
        format: "cjs",
      },
    },
  },
});
