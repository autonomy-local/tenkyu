import solid from "@solidjs/vite-plugin";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [solid(), vanillaExtractPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
