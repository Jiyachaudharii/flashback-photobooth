import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves the app from /flashback-photobooth/; other hosts serve it from the root.
  base: process.env.GITHUB_PAGES ? "/flashback-photobooth/" : "/",
  plugins: [react()],
});
