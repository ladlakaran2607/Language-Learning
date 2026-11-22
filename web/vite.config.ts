import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the build works at https://<user>.github.io/<repo>/ and anywhere else.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1200 },
  server: { fs: { allow: [".."] } }, // curriculum.md lives in ../.claude/skills/deutsch
});
