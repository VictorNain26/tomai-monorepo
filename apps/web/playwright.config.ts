import { defineConfig, devices } from '@playwright/test';

const PORT = 3012;
const baseURL = `http://localhost:${PORT}`;

// Phone first: every path is proven at phone width, on WebKit as on Chromium.
export default defineConfig({
  testDir: './tests',
  forbidOnly: !!process.env['CI'],
  reporter: 'list',
  use: { baseURL },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // The production server's own headers and fallback, CSP included, not those of vite preview.
    command: `bun ../server/scripts/serve-web.ts dist ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
