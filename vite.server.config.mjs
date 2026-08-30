import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.dirname(fileURLToPath(import.meta.url));
const alias = {
  "@mercicat/shared": path.join(root, "packages/shared/src/index.ts"),
  "@mercicat/content": path.join(root, "packages/content/src/index.ts"),
  "@mercicat/simulation": path.join(root, "packages/simulation/src/index.ts"),
  "@mercicat/protocol": path.join(root, "packages/protocol/src/index.ts"),
};
export default defineConfig({
  resolve: { alias },
  build: { ssr: "apps/server/src/main.ts", outDir: "dist-electron", emptyOutDir: false,
    rollupOptions: { output: { entryFileNames: "server.cjs", format: "cjs" } } },
});
