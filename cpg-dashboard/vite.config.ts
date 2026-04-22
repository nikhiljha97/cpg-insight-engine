import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { API_DEFAULT_PORT, DEV_SERVER_PORT, E2E_PREVIEW_PORT } from "./src/constants/appDefaults";

export default defineConfig({
  plugins: [react()],
  server: {
    port: DEV_SERVER_PORT,
    proxy: {
      "/api": {
        target: `http://localhost:${API_DEFAULT_PORT}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
  preview: {
    host: "127.0.0.1",
    port: E2E_PREVIEW_PORT,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${API_DEFAULT_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
