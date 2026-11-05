/**
 * Cross-check: every field of the app's row types in lib/data/types.ts must
 * exist as a column on the corresponding table in the migrated schema.
 * Catches the class of bug that shipped in Prompt 23 (recommendation columns
 * used by code but missing from migrations) before it reaches production.
 *
 * Run: node scripts/check_types_vs_schema.mjs
 * (starts its own embedded postgres, applies all migrations, then compares)
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = join(ROOT, "supabase/migrations");
const require = createRequire(import.meta.url);
let pg;
try {
  pg = require("pg");
} catch {
  pg = require("/tmp/pgtest/node_modules/pg/lib/index.js");
}
let EMBEDDED;
try {
  EMBEDDED = dirname(require.resolve("@embedded-postgres/linux-x64/package.json"));
} catch {
  EMBEDDED = "/tmp/pgtest/node_modules/@embedded-postgres/linux-x64";
}
const BIN = join(EMBEDDED, "native/bin");
const PGROOT = dirname(BIN);

// table -> row type in lib/data/types.ts. Fields that are NOT columns
// (relations, computed values) are whitelisted per table.
const TABLE_TYPES = {
  career_entries: { type: "CareerEntry", ignore: [] },
  voice_samples: { type: "VoiceSample", ignore: [] },
  user_settings: { type: "UserSettings", ignore: [] },
  jobs: { type: "Job", ignore: [] },
  status_history: { type: "StatusHistoryEntry", ignore: [] },
  applications: { type: "Application", ignore: [] },
  application_documents: { type: "ApplicationDocument", ignore: [] },
};

const sockdir = mkdtempSync(join(tmpdir(), "pg-types-"));
const pgdata = join(sockdir, "data");
const port = 5439;
const env = { ...process.env, LD_LIBRARY_PATH: join(PGROOT, "lib") };

function pgctl(args) {
  execFileSync(join(BIN, "pg_ctl"), ["-D", pgdata, ...args], { env, stdio: "ignore" });
}

function extractTypeFields(src, name) {
  const m = src.match(new RegExp(String.raw`export type ${name} = \{([\s\S]*?)\n\};`));
  if (!m) return null;
  const fields = [];
  for (const line of m[1].split("\n")) {
    const fm = line.match(/^\s{2}(\w+)(\?)?:/);
    if (fm) fields.push(fm[1]);
  }
  return fields;
}

let failures = 0;

try {
  rmSync(pgdata, { recursive: true, force: true });
  mkdirSync(pgdata, { recursive: true });
  execFileSync(join(BIN, "initdb"), ["-D", pgdata, "-U", "postgres", "-A", "trust"], {
    env, stdio: "ignore",
  });
  pgctl(["-l", join(sockdir, "pg.log"), "-o", `-p ${port} -k ${sockdir} -c listen_addresses=127.0.0.1`, "start"]);

  const client = new pg.Client({ host: sockdir, port, user: "postgres", database: "postgres" });
  await client.connect();
  await client.query("create database typescheck");
  await client.end();

  const db = new pg.Client({ host: sockdir, port, user: "postgres", database: "typescheck" });
  await db.connect();

  // Stub the Supabase environment (same as validate_migrations).
  await db.query(`
    create role authenticated nologin noinherit;
    create role anon nologin noinherit;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create or replace function auth.uid() returns uuid language sql stable as $fn$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $fn$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean default false,
      file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(),
      bucket_id text, name text, owner uuid, owner_id text, metadata jsonb,
      created_at timestamptz default now(), updated_at timestamptz default now());
    alter table storage.objects enable row level security;
    create or replace function storage.foldername(name text) returns text[]
      language sql immutable as $fn$ select string_to_array(name, '/') $fn$;
    grant usage on schema public, storage, auth to authenticated, anon;
    grant all on storage.objects to authenticated, anon;
  `);

  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    await db.query(readFileSync(join(MIGRATIONS, f), "utf8"));
  }

  const typesSrc = readFileSync(join(ROOT, "lib/data/types.ts"), "utf8");

  for (const [table, { type, ignore }] of Object.entries(TABLE_TYPES)) {
    const fields = extractTypeFields(typesSrc, type);
    if (!fields) {
      console.log(`??  ${type}: type not found in types.ts`);
      failures++;
      continue;
    }
    const { rows } = await db.query(
      `select column_name from information_schema.columns where table_schema='public' and table_name=$1`,
      [table],
    );
    const cols = new Set(rows.map((r) => r.column_name));
    const missing = fields.filter((f) => !cols.has(f) && !ignore.includes(f));
    if (missing.length === 0) {
      console.log(`ok  ${table} (${type}): all ${fields.length} fields exist as columns`);
    } else {
      console.log(`FAIL ${table} (${type}): columns missing from migrations: ${missing.join(", ")}`);
      failures++;
    }
  }

  await db.end();
  console.log(failures === 0 ? "TYPES VS SCHEMA: OK" : `TYPES VS SCHEMA: ${failures} problem(s)`);
  process.exitCode = failures === 0 ? 0 : 1;
} finally {
  try { pgctl(["stop", "-m", "fast"]); } catch {}
  rmSync(sockdir, { recursive: true, force: true });
}
