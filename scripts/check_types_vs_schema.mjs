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

  // Real columns in the migrated public schema, used by every phase below.
  const { rows: allCols } = await db.query(
    `select table_name, column_name from information_schema.columns where table_schema='public'`,
  );
  const schemaCols = new Map(); // table -> Set(columns)
  for (const r of allCols) {
    if (!schemaCols.has(r.table_name)) schemaCols.set(r.table_name, new Set());
    schemaCols.get(r.table_name).add(r.column_name);
  }

  for (const [table, { type, ignore }] of Object.entries(TABLE_TYPES)) {
    const fields = extractTypeFields(typesSrc, type);
    if (!fields) {
      console.log(`??  ${type}: type not found in types.ts`);
      failures++;
      continue;
    }
    const cols = schemaCols.get(table) ?? new Set();
    const missing = fields.filter((f) => !cols.has(f) && !ignore.includes(f));
    if (missing.length === 0) {
      console.log(`ok  ${table} (${type}): all ${fields.length} fields exist as columns`);
    } else {
      console.log(`FAIL ${table} (${type}): columns missing from migrations: ${missing.join(", ")}`);
      failures++;
    }
  }

  // Phase 2: every .order() column in the query layer must exist. This catches
  // the Plan crash that shipped in Prompt 24: listProjects ordered by a
  // created_at column that no migration (and no row type) ever defined, while
  // the row-type check above only sees .select("*") shapes.
  const queriesDir = join(ROOT, "lib/data/queries");
  let orderChecked = 0;
  for (const f of readdirSync(queriesDir).filter((f) => f.endsWith(".ts"))) {
    const src = readFileSync(join(queriesDir, f), "utf8");
    const froms = [...src.matchAll(/\.from\("(\w+)"\)/g)];
    for (const m of src.matchAll(/\.order\("(\w+)"/g)) {
      const at = m.index;
      const owner = froms.filter((fm) => fm.index < at).pop();
      if (!owner) continue;
      const [table, col] = [owner[1], m[1]];
      orderChecked++;
      if (!schemaCols.get(table)?.has(col)) {
        console.log(`FAIL ${f}: .order("${col}") but ${table} has no such column`);
        failures++;
      }
    }
  }
  if (failures === 0) console.log(`ok  .order() columns: ${orderChecked} orderings all valid`);

  // Phase 3: the generated expectations file must match the migrated schema
  // exactly in both directions (it drives Settings -> Database check).
  const expSrc = readFileSync(join(ROOT, "lib/data/schema-expectations.ts"), "utf8");
  const expected = new Map();
  for (const m of expSrc.matchAll(/table: "(\w+)", migration: "[^"]+", columns: \[([^\]]*)\]/g)) {
    expected.set(m[1], new Set([...m[2].matchAll(/"(\w+)"/g)].map((c) => c[1])));
  }
  let expProblems = 0;
  for (const [table, cols] of expected) {
    const real = schemaCols.get(table);
    if (!real) {
      console.log(`FAIL expectations: table ${table} does not exist in the migrated schema`);
      expProblems++;
      continue;
    }
    for (const c of cols) {
      if (!real.has(c)) {
        console.log(`FAIL expectations: ${table}.${c} expected but no migration creates it`);
        expProblems++;
      }
    }
  }
  for (const [table, real] of schemaCols) {
    if (!expected.has(table)) {
      console.log(`FAIL expectations: public.${table} exists but is not in schema-expectations.ts`);
      expProblems++;
      continue;
    }
    for (const c of real) {
      if (!expected.get(table).has(c)) {
        console.log(`FAIL expectations: ${table}.${c} exists in migrations but not in schema-expectations.ts`);
        expProblems++;
      }
    }
  }
  failures += expProblems;
  if (expProblems === 0) console.log(`ok  schema-expectations.ts: ${expected.size} tables match the migrated schema`);

  // Phase 4: execute the two generated paste files verbatim - both on the
  // fully migrated database (idempotent re-paste) and on a fresh database
  // (first-time setup). A single failing statement (like the `on
  // public.storage` drops that once aborted the user's paste halfway through
  // section 0003) fails the check instead of breaking production silently.
  const admin = new pg.Client({ host: sockdir, port, user: "postgres", database: "postgres" });
  await admin.connect();
  await admin.query("create database freshpaste");
  await admin.end();
  const fresh = new pg.Client({ host: sockdir, port, user: "postgres", database: "freshpaste" });
  await fresh.connect();
  // Roles are cluster-wide, so the stub only creates them when missing.
  await fresh.query(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin noinherit;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin noinherit;
      end if;
    end $$;
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
  for (const file of ["supabase/apply_all_migrations.sql", "supabase/fix_now.sql"]) {
    const sql = readFileSync(join(ROOT, file), "utf8");
    try {
      await db.query(sql);
      console.log(`ok  ${file}: executes cleanly on a fully migrated database`);
    } catch (err) {
      console.log(`FAIL ${file}: ${err.message.split("\n")[0]}`);
      failures++;
    }
    try {
      await fresh.query(sql);
      console.log(`ok  ${file}: executes cleanly on a fresh database`);
    } catch (err) {
      console.log(`FAIL ${file} (fresh): ${err.message.split("\n")[0]}`);
      failures++;
    }
  }
  await fresh.end();

  await db.end();
  console.log(failures === 0 ? "TYPES VS SCHEMA: OK" : `TYPES VS SCHEMA: ${failures} problem(s)`);
  process.exitCode = failures === 0 ? 0 : 1;
} finally {
  try { pgctl(["stop", "-m", "fast"]); } catch {}
  rmSync(sockdir, { recursive: true, force: true });
}
