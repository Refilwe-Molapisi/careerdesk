import { test, expect } from "@playwright/test";

/**
 * Full-flow E2E with DeepSeek mocked (Prompt 11, item 6). Runs against a
 * throwaway Supabase test project (email confirmation off):
 *   E2E_SUPABASE_URL / E2E_SUPABASE_ANON_KEY in the environment.
 *
 * Covers: sign up, add a career entry with evidence, add a job by pasted
 * description, run the fit report, draft both documents, check the
 * poisoned-draft case (fake source id + unsupported number must be rejected
 * and shown as flagged), revise a part, approve, export PDF, record the
 * application, and change the job status.
 */

const EMAIL = `e2e-${Date.now()}@example.com`;
const PASSWORD = "E2eTest-Passw0rd!";

test.skip(
  !process.env.E2E_SUPABASE_URL || !process.env.E2E_SUPABASE_ANON_KEY,
  "Set E2E_SUPABASE_URL and E2E_SUPABASE_ANON_KEY against a throwaway test project to run the E2E suite.",
);

async function mockMode(mode: string, request: import("@playwright/test").APIRequestContext) {
  await request.post("http://127.0.0.1:3222/mode", { data: { mode } });
}

test("full tailoring flow with honest AI output", async ({ page, request }) => {
  await mockMode("honest", request);

  // Sign up through the real auth flow.
  await page.goto("/login");
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password", { exact: false }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");

  // Career Record: add one evidenced entry.
  await page.goto("/record");
  await page.getByRole("button", { name: "Add first entry" }).click();
  await page.getByLabel("Title *").fill("Finance assistant");
  await page.getByLabel("Organisation").fill("Acme Trading");
  await page
    .getByLabel("Description")
    .fill("Reconciled supplier accounts and supported monthly reporting.");
  await page
    .getByLabel(/Evidence/)
    .fill("Reconciled 300 supplier accounts monthly in Excel.");
  await page.getByRole("button", { name: "Save entry" }).click();

  // Jobs: add by pasted description.
  await page.goto("/jobs/new");
  await page
    .getByLabel(/Job description/)
    .fill(
      "Junior BI Analyst. You will reconcile accounts, build Excel reports and dashboards. Essential: Excel, reconciliation. Apply on our site.",
    );
  await page.getByRole("button", { name: "Extract details" }).click();
  await page.getByRole("button", { name: "Save job" }).click();
  await page.waitForURL("**/jobs/*");

  // Tailor: fit report -> drafts.
  await page.getByRole("link", { name: "Tailor my application" }).click();
  await page.getByRole("button", { name: "Run fit report" }).click();
  await expect(page.getByText("Excel reconciliation experience")).toBeVisible();
  await page
    .getByRole("button", { name: "Draft CV and cover letter" })
    .click();
  await expect(page.getByText("passed the deterministic claim checks")).toBeVisible({
    timeout: 30_000,
  });

  // Review screen: approve both documents.
  await page.getByRole("button", { name: "Save my edits (new version)" }).click();
  await page.getByRole("button", { name: "Approve this version" }).click();
  await expect(page.getByText(/approved/)).toBeVisible();

  // Export the PDF and record the application.
  await page.getByRole("button", { name: "Export PDF" }).click();
  await page.getByRole("button", { name: /Mark as applied with these documents/ }).click();
  await expect(page.getByText(/Recorded as applied/)).toBeVisible();

  // Documents page lists both with hashes; job status moved to Applied.
  await page.goto("/documents");
  await expect(page.getByText("CV v1")).toBeVisible();
  await page.goto("/jobs");
  await expect(page.getByText("Applied").first()).toBeVisible();
});

test("poisoned draft: fake source id and unsupported number are rejected", async ({
  page,
  request,
}) => {
  await mockMode("poisoned", request);

  // Sign in as the existing user from the first test (same browser context
  // is not shared, so sign in again).
  await page.goto("/login");
  await page.getByRole("tab", { name: "Sign in" }).click();
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password", { exact: false }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");

  await page.goto("/jobs");
  await page.getByRole("link", { name: /Untitled role|BI Analyst/ }).first().click();
  await page.getByRole("link", { name: "Continue tailoring" }).click();

  // The poisoned draft runs: its unsupported number must surface as a
  // flagged line, never as approved text.
  await page.getByRole("button", { name: "Draft CV and cover letter" }).click();
  await expect(page.getByText(/Claim check flagged/)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/5000/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Fix flagged lines to approve/ })).toBeVisible();
});
