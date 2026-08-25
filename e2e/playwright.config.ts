import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const DB_PATH = '/tmp/e2e_githelp.db';
const PORT = 8099;
const binaryPath = path.resolve(__dirname, '..', 'bin', 'githelp');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `PORT=${PORT} DB_PATH=${DB_PATH} "${binaryPath}"`,
    url: `http://127.0.0.1:${PORT}/api/status`,
    reuseExistingServer: false,
    timeout: 15000,
    cwd: path.resolve(__dirname, '..'),
  },
});
