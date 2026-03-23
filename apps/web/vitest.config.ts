import path from "node:path";
import { defineConfig, defineProject } from "vitest/config";
import react from "@vitejs/plugin-react";

const jsdomPatterns = [
  "src/**/*.test.tsx",
  "src/**/hooks/**/*.test.ts",
];

const nodePatterns = [
  "src/**/*.test.ts",
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: `${path.resolve(__dirname, "src").replace(/\\/g, "/")}/`,
      },
      {
        find: /^@motionroll\/shared$/,
        replacement: path.resolve(
          __dirname,
          "..",
          "..",
          "packages",
          "shared",
          "src",
          "index.ts",
        ),
      },
      {
        find: /^@motionroll\/runtime$/,
        replacement: path.resolve(
          __dirname,
          "..",
          "..",
          "packages",
          "runtime",
          "src",
          "index.ts",
        ),
      },
    ],
  },
  test: {
    projects: [
      defineProject({
        test: {
          name: "dom",
          environment: "jsdom",
          include: jsdomPatterns,
        },
      }),
      defineProject({
        test: {
          name: "node",
          environment: "node",
          include: nodePatterns,
          exclude: ["src/**/hooks/**/*.test.ts"],
        },
      }),
    ],
  },
});
