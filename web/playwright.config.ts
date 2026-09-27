import { defineConfig } from "@playwright/test";

/**
 * E2E suite. Starts the production build on :3100 using a dedicated e2e
 * database so test users never pollute dev data.
 *
 *   npx playwright install chromium   # one-time
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command:
      "npx prisma db push --skip-generate && npx next build && npx next start -p 3100",
    url: "http://localhost:3100",
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: "file:./e2e.db",
      APP_SECRET: "e2e-secret-0123456789abcdef0123456789abcdef0123456",
      APP_URL: "http://localhost:3100",
    },
  },
});
