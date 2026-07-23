import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/hubei-normal-812-study/",
  plugins: [react()],
  build: {
    target: "es2020",
    outDir: "docs",
  },
});
