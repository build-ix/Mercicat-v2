import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "@mercicat/client": resolve(__dirname, "../../packages/client/src/index.ts"),
    },
  },
  build: { chunkSizeWarningLimit: 400, rollupOptions: { output: { manualChunks: { three: ["three"] } } } }
});
