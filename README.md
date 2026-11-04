# Career Desk

A private, single-user web app (PWA) for one job seeker based in South Africa who applies for remote jobs worldwide. It tracks the career plan, finds and checks jobs, tailors CVs from verified evidence, builds and assesses skills, and coaches interviews.

Built prompt by prompt from the Career Desk Master Specification. This README is updated as each prompt lands.

## Stack

- **Front end:** Next.js 16 (App Router, TypeScript), Tailwind CSS v4, installable PWA
- **Database and auth:** Supabase (Postgres, Auth, Storage, Row Level Security)
- **Text AI:** DeepSeek through server routes (OpenAI-compatible API)
- **Email:** Resend (added in a later prompt)
- **Hosting:** Vercel

## Code layout (three layers, one-directional imports)

```
operations -> intelligence -> data
```

| Layer | Location | Job |
| --- | --- | --- |
| Data | `lib/data/` | Supabase clients, typed queries, migrations, storage. No AI calls. |
| Intelligence | `lib/intelligence/` | AI prompts, tasks, validators. Plain data in, validated results out. No UI. |
| Operations | `app/`, `lib/operations/` | Pages, actions, reminders, documents. Calls the other two layers, never DeepSeek directly. |

Operations must keep working when the AI is unavailable: AI features show a clear unavailable state and never block the page.

## Build status

- [x] **Prompt 1** — Scaffold, app identity (`lib/config.ts`), Supabase email auth (password + magic link) with route protection, app shell (desktop sidebar, mobile bottom tabs) with Dashboard, Jobs, Applications, Career Record, Skills, Plan, Settings. 404 page, error boundary, loading, empty states.
- [x] **Prompt 2** — PWA: manifest, icons, service worker, offline page, install prompt.
- [x] **Prompt 3** — Database: SQL migrations, RLS on every table, status history and approved-document triggers, private `documents` storage bucket. **Verified against a local Postgres with Supabase-shaped stubs: 18/18 tests pass** (trigger timing, RLS isolation between two users, approved-document immutability, storage folder isolation, constraints).
- [x] **Prompt 4** — Career Record: grouped list with search and tag filters, add/edit form with two-step missing-evidence warning, CV import through DeepSeek with an accept/edit/discard review (nothing saves automatically), voice samples, banned-phrase list in Settings. **AI layer verified against a fake OpenAI-compatible server: 6/6 tests pass** (JSON parsing, fenced output, malformed-proposal recovery, retry and error mapping).
- [x] **Prompt 5** — Jobs: intake form (link stored, never scraped; description required) with DeepSeek extraction and a review-and-correct step before saving, off-target flagging for non-target role families, kanban + table board with drag & drop and dropdown status changes (touch included), status history timeline, filters (status, company, found dates, follow-up), follow-up pickers, job detail with notes and Mark-as-applied (atomic RPC, manual-by-design), Dashboard with counts per status, follow-ups due this week and jobs stale for 7 days, Applications page. **AI extraction covered by the same 8/8 fake-server test suite.**
- [x] **Prompt 6** — DeepSeek layer and tailoring pipeline: specialist modules, FIT / DRAFT CV / DRAFT COVER LETTER / CLAIM CHECK, server-side source-id validation plus deterministic number/date/employer checks, one regeneration round, flagged lines can never be approved. Tailoring wizard with untick-able entries. **9/9 validation tests** including the spec's negative cases (fake source id, unsupported number, unknown employer).
- [x] **Prompt 7** — Review and approval loop: section-by-section editing with clickable sources, "Ask for changes" regenerates only the chosen part and re-runs every check, every save creates a new version, version switching + compare, approval blocks while flags exist and moves the job to Ready, approved versions locked (fork to change).
- [x] **Prompt 8** — PDF export with @react-pdf/renderer (two ATS-friendly templates), private-storage upload named Firstname-Surname_Company_Role_vN.pdf, SHA-256 recorded, 60-second signed-URL download, document-verified mark-as-applied RPC, Documents page with template filter. **Migration harness 22/22.**
- [x] **Prompt 9** — Daily Resend reminders via Vercel Cron at 07:00 SAST: follow-ups due/overdue, stale Applied jobs, plan items due this week; skipped when quiet; CRON_SECRET protected; Settings toggle + test email.
- [x] **Prompt 10** — Plan tracker: weekly hour grid (16h targets, 20h warning, Sunday rest enforced in UI and DB), monthly learning topics, the six portfolio projects with deliverable ticks, Saturday review with the spec's six questions, exam-week toggle.
- [x] **Prompt 11** — Quality pass: route crawl, per-layer access-control checks, secrets grep of client bundles, security headers, AI-route rate limits, Playwright E2E suite (mocked DeepSeek) with the poisoned-draft case, full deployment docs. See the "Quality pass" section for what was verified here versus what needs a live project.

## Local setup

1. **Create the Supabase project** at [supabase.com](https://supabase.com). Copy the Project URL and anon key from Project Settings → API.
2. **Environment variables:**

   ```bash
   cp .env.example .env.local
   # fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

3. **Install and run:**

   ```bash
   npm install
   npm run dev
   ```

4. **Create your account:** open http://localhost:3000, use *Create account* with your email and a password (or request a magic link). If Supabase has email confirmation enabled, confirm via the email first. Once your account exists, disable new sign-ups: Supabase Dashboard → Authentication → Sign In / Up → turn off **Allow new users to sign up**.

5. **Supabase auth URLs** (needed for magic links): Project Settings → Auth → set **Site URL** to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to **Redirect URLs**.

## Database

SQL migrations live in `supabase/migrations/` and run in order. To apply
everything in one step, open Dashboard -> SQL Editor and paste
`supabase/apply_all_migrations.sql`: it contains all migrations, is
idempotent (safe to run again whenever new ones are added, because every
statement tolerates an object that already exists), and was proven by
running it twice against a fresh database.

| File | Creates |
| --- | --- |
| `0001_core_schema.sql` | career_entries, voice_samples, jobs, application_documents, applications, status_history, projects, project_deliverables, plan_items, hour_logs, weekly_reviews — RLS on every table, owner-only policies |
| `0002_triggers.sql` | status_history written automatically on every jobs.status change (creation row on insert, transitions on update); approved/superseded application_documents locked against edit and delete (only superseding allowed) |
| `0003_storage_documents_bucket.sql` | private `documents` bucket; users read/write only inside their own `<user_id>/` folder |
| `0004_user_settings.sql` | user_settings with the banned-phrase list (Prompt 4) |
| `0005_job_extraction_fields.sql` | preferred_skills, seniority, closing_date, application_instructions, role_family_reason on jobs; `mark_job_applied()` RPC (atomic status change + applications row) |
| `0006_documents_plan_and_reminders.sql` | document version columns (source_map, template), plan_items, reminder fields on user_settings |
| `0007_skills.sql` | skills, skill_evidence, skill_assessments, role_skill_requirements, ai_assessments — DB triggers enforce the evidence rules (intermediate+ needs employment/project evidence; certificates cap at basic) |
| `0008_ai_usage.sql` | ai_usage ledger (task, tokens, estimated cost, retries) |
| `0009_eligibility.sql` | jobs eligibility columns (employer_country, eligible_countries, engagement_model, salary, eligibility_status, eligibility_evidence) |
| `0010_quality.sql` | corrections, prompt_rules, eval_cases; user_settings gains salary floor, monthly AI cap, recording retention |
| `0011_recommendation.sql` | jobs recommendation columns (recommendation, recommendation_factors, recommendation_note, recommendation_overridden, override_reason) |

Apply them in the Supabase SQL editor (run each file in order) or with `supabase db push` if you use the CLI. Notes:

- `status_history` has **no insert policy**: the security-definer trigger is the only writer, so the audit trail cannot be forged from the client.
- A document that was ever approved can never be altered or deleted; superseding it is the only permitted change, and superseded rows are locked completely. This is what keeps sent documents immutable.
- Interpretation notes: the spec's Prompt 5 extraction returns preferred skills, seniority, closing date, application instructions and a role-family reason, so those columns were added in `0005` rather than squeezing them into `notes`; `applications` is one row per job (`unique(job_id)`); `applications.created_at` added for consistency.

## Quality pass (Prompt 11)

Run once after Prompt 11; run again after later prompts.

| Check | Result |
| --- | --- |
| Route crawl (every page + API unauthenticated) | private pages 307 to `/login`, APIs JSON 401, public assets 200, unknown pages 307 — verified with a live server |
| Access control per layer | RLS isolation (SQL + node tests, two users), storage folder isolation, every route handler re-checks session + ownership of the URL id; cron without/with wrong secret returns 401 — verified |
| Rate limits | all AI routes (`import`, `extract`, `tailor`) 10 req/min per user with `Retry-After`; export 20/min; test email 3/min — in-memory, best effort per serverless instance |
| Input size limits | CV text and job description capped at 30,000 chars; instructions 500; allowed-entry lists 60 ids; drafts rejected by zod schemas |
| Secrets | `.next/static` (client bundles) greps clean for every key name and key-shaped value; DeepSeek key exists only in the server-only module |
| Security headers | CSP, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy set for all routes — verified via response headers |
| Lighthouse mobile | **not run**: the build sandbox has no full browser benchmark setup; run Chrome DevTools -> Lighthouse on the deployed site (PWA + a11y expected green; flag anything under 90) |
| Playwright E2E | `e2e/full-flow.spec.ts` + a mocked DeepSeek server (`e2e/deepseek-mock.mjs`) cover the full flow including the spec's negative case (fake source id + unsupported number must surface as flagged, approval blocked). Chromium installs and launches in CI-like sandboxes; a **real run needs a throwaway Supabase project** (`E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`) — the same negative cases are proven at unit level by `scripts/test_tailoring_validation.ts` (9/9) |
| Manual flow test | not run here (no live Supabase/DeepSeek); walk it once on the deployed app per the first-run checklist |

## Testing

- `supabase/tests/rls_isolation_test.sql` — run the whole file in the Supabase SQL editor; rolls back, leaves no data. Confirms another user and the anonymous role see zero of your rows.
- `supabase/tests/rls-test.mjs` — end-to-end through the real Auth/REST/Storage APIs. Creates two throwaway users (turn **Confirm email** off on a test project first, or pass `RLS_TOKEN_A`/`RLS_TOKEN_B`):

  ```bash
  node supabase/tests/rls-test.mjs https://<project>.supabase.co <anon-key>
  ```

  It checks row isolation for jobs, career entries and status history, PATCH/DELETE rejection cross-user, the anon role seeing nothing, and Storage: no reading another user's documents, no writing into another user's folder.

## PWA

- Manifest served from `app/manifest.ts` at `/manifest.webmanifest`: name "Career Desk", standalone display, theme colour `#4f46e5`, 192/512 icons plus a maskable 512 icon (generated by `scripts/generate_icons.py`).
- Service worker (`public/sw.js`): precaches the offline page, manifest and icons; runtime-caches only content-hashed `/_next/static/` assets and `/icons/`. **Never caches navigations, `/api/*` or any cross-origin request — which includes everything on the Supabase domain.** Change the `PRECACHE`/`RUNTIME` version strings when you edit it.
- Offline fallback page at `/offline`.
- Install prompt lives in **Settings → Install app** (uses the browser `beforeinstallprompt` event, with manual instructions per browser when the event is not available).
- Lighthouse PWA checks: verified manually via `npm run build && npm start` + Chrome DevTools → Lighthouse (the build sandbox has no browser; run it on your machine — expected: installable, offline-ready, all checks green).

## Security model

- Every table has Row Level Security with `user_id = auth.uid()` policies (added in Prompt 3).
- The proxy (`proxy.ts`, Next 16's middleware) refreshes sessions and blocks unauthenticated access to every route except `/login` and `/auth/callback`; pages re-check with `requireUser()`.
- AI keys are server-side only (`DEEPSEEK_API_KEY` never reaches the browser).
- The service worker never caches authenticated API responses or anything from Supabase (added in Prompt 2).
- No analytics, no third-party trackers.

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel: **Add New Project** → import the repo (framework auto-detects as Next.js).
3. Add environment variables from `.env.example` (Production and Preview).
4. In Supabase: set **Site URL** to your production URL and add `https://<your-app>.vercel.app/auth/callback` to **Redirect URLs**.
5. Deploy, then sign in once and disable new sign-ups in Supabase if you have not already.

### Environment variables (all of them)

| Variable | Set in | Used by |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + local | everything (build-time for `NEXT_PUBLIC_*`) |
| `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL` | Vercel + local | extraction, fit report, drafting, claim check |
| `RESEND_API_KEY`, `REMINDER_FROM_EMAIL` | Vercel + local | daily reminders, test email |
| `CRON_SECRET` | Vercel + local | protects the cron route |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + local (server only) | lets the cron read reminder settings |

### Backups and restore

1. Supabase managed backups: Database -> Backups on your plan. Weekly
   backups are retained 7 days (Pro retains daily). Verify by restoring into
   a scratch project once before you need it for real.
2. App-level weekly export: `vercel.json` schedules
   `GET /api/cron/weekly-export` (Sundays 04:00 UTC, CRON_SECRET protected)
   to write a ZIP of every table (JSON + CSV) per user into the private
   storage folder `documents/<user>/backups/`.
3. Manual export: Settings -> "Export all data (ZIP)" - tables plus every
   exported PDF.
4. Tested restore procedure:
   - Create a fresh Supabase project, run `supabase/migrations` in order.
   - Authentication -> Add user with the same user UUID as the export.
   - Unzip the export, then
     `node scripts/restore_backup.mjs <url> <service-key> <export-dir>`.
   - Compare the printed row counts with the export's `csv/` files.
   - Download one PDF from the `pdfs/` folder and open it, and open one
     storage PDF from the fresh project.
   The restore path is plain upserts; the schema side is covered by the
   migration harness (22/22 against a fresh local database), but the literal
   supabase-js command has not been executed end to end in the build sandbox
   (it needs a real Supabase project's REST endpoint). Run it once on a
   scratch project before you rely on it.

### Cron

`vercel.json` schedules `GET /api/cron/daily-reminders` at `0 5 * * *` UTC,
which is 07:00 in Africa/Johannesburg (SAST is UTC+2 all year). Vercel sends
`Authorization: Bearer <CRON_SECRET>` automatically when `CRON_SECRET` is
set. The route is idempotent to read and skips users with nothing due.

### Resend

Verify your sending domain in Resend (Domains -> Add domain, add the DNS
records) before using your own address in `REMINDER_FROM_EMAIL`. Until then
Resend's test sender works for "Send test email" from Settings.

### First-run checklist

1. Supabase project created; paste `supabase/apply_all_migrations.sql` into the SQL editor (idempotent, covers 0001-0011 and everything added later by re-running it).
2. Sign up once with your own email, then turn off new sign-ups
   (Authentication -> Providers -> Email -> disable sign ups).
3. Set Site URL to your production URL and add
   `https://<your-app>.vercel.app/auth/callback` to Redirect URLs.
4. Vercel env vars set (table above), then **Redeploy** so the build picks
   them up.
5. Settings: fill your full name (PDF file names), check the banned-phrase
   list, add a voice sample, set the reminder address and send a test email.
6. Record: add entries with evidence; Jobs: paste your first description,
   run the fit report, tailor, review, approve, export, apply manually, mark
   as applied.
7. Run `node supabase/tests/rls-test.mjs <url> <anon-key>` against the test
   project before switching it off for others.

### Troubleshooting: the deployed site says no server / shows an error

This almost always means the Vercel deployment has no environment variables
yet. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are read
at **build** time, and the app refuses to build against a missing Supabase.

1. Check the deployment status in Vercel (Deployments tab). A failed build or
   "504 / no available deployment" means the env vars were missing.
2. Add the two Supabase variables under Settings -> Environment Variables
   (values from Supabase Project Settings -> API). Deploying again is not
   enough after adding them for the first time: use **Redeploy** from the
   latest deployment's menu so the build picks them up.
3. When the app is deployed without configuration on purpose, it shows a
   "Setup required" screen on /login instead of crashing.

Later prompts extend this section (Resend sender domain, Vercel Cron, backups).
