import { defineConfig, devices } from "@playwright/test";

const PORT = 3011;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL,
    reducedMotion: "reduce",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `bunx next build && bunx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
