import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  // Tauri dev server
  server: {
    port: 1420,
    strictPort: true,
  },
  // Tauri expects a fixed output directory
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  // Suppress Vite from opening the browser — Tauri manages the window
  clearScreen: false,
});
