import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "./src/test/jsdom-node-fetch.ts",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    restoreMocks: true,
    env: {
      NEXT_PUBLIC_API_URL: "https://api.vultra.test",
      NEXT_PUBLIC_APP_URL: "https://portal.vultra.test",
    },
  },
});
