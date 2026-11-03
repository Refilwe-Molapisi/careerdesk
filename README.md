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
- [ ] **Prompt 4** — Career Record page, CV import with review, voice samples, banned phrases.
- [ ] **Prompt 5** — Job intake with AI extraction, jobs board (kanban + table), status history, Dashboard.

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

SQL migrations live in `supabase/migrations/` and run in order:

| File | Creates |
| --- | --- |
| `0001_core_schema.sql` | career_entries, voice_samples, jobs, application_documents, applications, status_history, projects, project_deliverables, plan_items, hour_logs, weekly_reviews — RLS on every table, owner-only policies |
| `0002_triggers.sql` | status_history written automatically on every jobs.status change (creation row on insert, transitions on update); approved/superseded application_documents locked against edit and delete (only superseding allowed) |
| `0003_storage_documents_bucket.sql` | private `documents` bucket; users read/write only inside their own `<user_id>/` folder |
| `0004_user_settings.sql` | user_settings with the banned-phrase list (Prompt 4) |
| `0005_job_extraction_fields.sql` | preferred_skills, seniority, closing_date, application_instructions, role_family_reason on jobs; `mark_job_applied()` RPC (atomic status change + applications row) |

Apply them in the Supabase SQL editor (run each file in order) or with `supabase db push` if you use the CLI. Notes:

- `status_history` has **no insert policy**: the security-definer trigger is the only writer, so the audit trail cannot be forged from the client.
- A document that was ever approved can never be altered or deleted; superseding it is the only permitted change, and superseded rows are locked completely. This is what keeps sent documents immutable.
- Interpretation notes: the spec's Prompt 5 extraction returns preferred skills, seniority, closing date, application instructions and a role-family reason, so those columns were added in `0005` rather than squeezing them into `notes`; `applications` is one row per job (`unique(job_id)`); `applications.created_at` added for consistency.

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

Later prompts extend this section (Resend sender domain, Vercel Cron, backups).
