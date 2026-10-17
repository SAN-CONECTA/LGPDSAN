import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.mjs',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:8000',
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: [
    { command: 'npx firebase emulators:start --project demo-lgpdsan --only auth,firestore,storage,functions', url: 'http://127.0.0.1:9099', timeout: 120000, reuseExistingServer: false },
    { command: 'python3 -m http.server 8000', url: 'http://127.0.0.1:8000/index.html', timeout: 30000, reuseExistingServer: false }
  ]
});
