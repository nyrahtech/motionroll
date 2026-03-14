import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@motionroll/shared": path.resolve(
        __dirname,
        "..",
        "..",
        "packages",
        "shared",
        "src",
        "index.ts",
      ),
      "@motionroll/runtime": path.resolve(
        __dirname,
        "..",
        "..",
        "packages",
        "runtime",
        "src",
        "index.ts",
      ),
    },
  },
  test: {
    environment: "node",
  },
});
