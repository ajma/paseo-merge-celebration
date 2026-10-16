import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./browser",
  testMatch: "*.spec.ts",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4197", headless: true, channel: "chrome" },
  webServer: {
    command: "npx vite --config vite.config.ts",
    url: "http://127.0.0.1:4197",
    reuseExistingServer: true,
  },
});
