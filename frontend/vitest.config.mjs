import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/unit/setup.tsx"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.{test,spec}.{ts,tsx}"
    ],
    exclude: ["node_modules", ".next", "dist"],
    // Handle CSS imports in tests
    css: true,
  },
  resolve: {
    alias: { 
      "@": path.resolve(__dirname, "./src"),
      // Next.js aliases
      "@/components": path.resolve(__dirname, "./src/components"),
      "@/lib": path.resolve(__dirname, "./src/lib"),
      "@/hooks": path.resolve(__dirname, "./src/hooks"),
      "@/contexts": path.resolve(__dirname, "./src/contexts"),
      "@/tests": path.resolve(__dirname, "./tests"),
    },
  },
  // Next.js compatibility
  define: {
    "process.env": {},
  },
  // Handle CSS and other assets
  assetsInclude: ["**/*.css"],
});

