import { defineConfig,devices } from '@playwright/test';
export default defineConfig({
  testDir:'./e2e', fullyParallel:false, workers:1, reporter:'list',
  use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure'},
  projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}],
  webServer:{command:'node ../backend/src/scripts/startIsolatedDemo.js',url:'http://127.0.0.1:4173/api/health',reuseExistingServer:false,timeout:30000},
});
