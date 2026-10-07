import { defineConfig, devices } from '@playwright/test';

const PORT = 3011;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  forbidOnly: !!process.env['CI'],
  reporter: 'list',
  use: {
    baseURL,
    reducedMotion: 'reduce',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // The Caddy that Clever Cloud runs, with the same Caddyfile: headers, redirects and the 404 are tested as served.
  webServer: {
    command: `docker run --rm --init -p ${PORT}:8080 -v ${import.meta.dirname}/dist:/srv/dist:ro -v ${import.meta.dirname}/Caddyfile:/srv/Caddyfile:ro -w /srv caddy:2.11.4-alpine caddy run --config Caddyfile`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
    // Killed outright, the docker client would leave the container running.
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
  },
});
