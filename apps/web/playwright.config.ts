import { defineConfig, devices } from "@playwright/test";

const PORT = 3012;
const baseURL = `http://localhost:${PORT}`;

// Phone first: every path is proven at phone width, on WebKit as on Chromium.
export default defineConfig({
  testDir: "./tests",
  forbidOnly: !!process.env["CI"],
  reporter: "list",
  use: { baseURL },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 15"] } },
    { name: "android", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `bunx --no-install vite build && bunx --no-install vite preview --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
