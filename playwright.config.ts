import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end test for the full tailoring flow (Prompt 11). DeepSeek is
 * mocked: every call to the OpenAI-compatible endpoint is intercepted in the
 * browser-adjacent layer by REPLAYING canned responses (see
 * e2e/deepseek-mock.mjs, a standalone server the config starts before the
 * run, with DEEPSEEK_BASE_URL pointed at it).
 *
 * Requirements to run: a throwaway Supabase test project with email
 * confirmation off, and its URL/anon key in e2e/.env.local:
 *   E2E_SUPABASE_URL=... E2E_SUPABASE_ANON_KEY=...
 * Run: npx playwright test
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command:
          "DEEPSEEK_BASE_URL=http://127.0.0.1:3222 npm run start",
        url: "http://localhost:3000/login",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
