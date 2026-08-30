const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev:renderer',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});
