import { defineConfig } from "vite";
export default defineConfig({
  build: { chunkSizeWarningLimit: 400, rollupOptions: { output: { manualChunks: { three: ["three"] } } } }
});
