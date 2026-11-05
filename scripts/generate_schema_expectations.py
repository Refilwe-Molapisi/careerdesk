"""
Generates, from the migration files:
 1. lib/data/schema-expectations.ts - every table + column the migrations
    create, as data the app can check at runtime (Settings -> Database check).
 2. supabase/fix_now.sql - migrations 0004-0011 + core column patches, compact
    (comments and blank lines stripped), ending with a PostgREST schema
    cache reload notice.

Run: python3 scripts/generate_schema_expectations.py
"""
import re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIG = os.path.join(ROOT, "supabase/migrations")

def split_statements(sql):
    stmts, buf = [], []
    i, n = 0, len(sql)
    NORMAL, LINE_C, BLOCK_C, SQUOTE = 0, 1, 2, 3
    state = NORMAL
    in_dollar = False
    while i < n:
        ch = sql[i]
        nxt = sql[i + 1] if i + 1 < n else ""
        if in_dollar:
            if sql.startswith("$$", i):
                in_dollar = False
                buf.append("$$")
                i += 2
                continue
            buf.append(ch)
            i += 1
            continue
        if state == NORMAL and sql.startswith("$$", i):
            in_dollar = True
            buf.append("$$")
            i += 2
            continue
        if state == NORMAL and ch == "-" and nxt == "-":
            state = LINE_C
            i += 2
            continue
        if state == LINE_C:
            if ch == "\n":
                state = NORMAL
            i += 1
            continue
        if state == NORMAL and ch == "/" and nxt == "*":
            state = BLOCK_C
            i += 2
            continue
        if state == BLOCK_C:
            if ch == "*" and nxt == "/":
                i += 2
                state = NORMAL
                continue
            i += 1
            continue
        if state == NORMAL and ch == "'":
            state = SQUOTE
            buf.append(ch)
            i += 1
            continue
        if state == SQUOTE:
            buf.append(ch)
            if ch == "'":
                if nxt == "'":
                    buf.append("'")
                    i += 2
                    continue
                state = NORMAL
            i += 1
            continue
        if state == NORMAL and ch == ";":
            s = "".join(buf).strip()
            if s:
                stmts.append(s)
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1
    tail = "".join(buf).strip()
    if tail:
        stmts.append(tail)
    return stmts

# 1. Walk every migration, collect tables and columns.
tables = {}  # name -> {"columns": set(), "migration": file}
for f in sorted(os.listdir(MIG)):
    if not f.endswith(".sql"):
        continue
    sql = open(os.path.join(MIG, f)).read()
    for stmt in split_statements(sql):
        m = re.match(r"(?is)^\s*create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\((.*)\)\s*$", stmt, re.S)
        if m:
            tname, body = m.group(1), m.group(2)
            cols = tables.setdefault(tname, {"columns": set(), "migration": f})["columns"]
            depth = 0
            in_string = False
            for line in body.splitlines():
                ls = line.strip()
                if not ls:
                    continue
                if in_string:
                    # Still inside a multi-line quoted default (e.g. a text[]
                    # default listing banned phrases): never a column name.
                    if ls.count("'") % 2 == 1:
                        in_string = False
                    continue
                opens = ls.count("(") - ls.count(")")
                if depth == 0:
                    cm = re.match(r"^(?:\"(\w+)\"|(\w+))\s", ls)
                    if cm:
                        col = cm.group(1) or cm.group(2)
                        if col.upper() not in (
                            "PRIMARY", "FOREIGN", "UNIQUE", "CHECK", "CONSTRAINT", "EXCLUDE",
                        ):
                            cols.add(col)
                depth += opens
                if depth < 0:
                    depth = 0
                if ls.count("'") % 2 == 1:
                    in_string = True
            continue
        m = re.match(
            r"(?is)^\s*alter\s+table\s+(?:only\s+)?(?:public\.)?(\w+)\s+(.*)$",
            stmt,
        )
        if m:
            tname, rest = m.group(1), m.group(2)
            t = tables.setdefault(tname, {"columns": set(), "migration": f})
            # one alter can carry several comma-separated add column clauses
            for cm in re.finditer(
                r"(?is)add\s+column\s+(?:if\s+not\s+exists\s+)?(?:\"?(\w+)\"?)", rest
            ):
                t["columns"].add(cm.group(1))
            # earliest migration wins for the "which file to run" label
            if f < t["migration"]:
                t["migration"] = f

expectations = [
    {"table": t, "columns": sorted(cols), "migration": meta["migration"]}
    for t, (cols, meta) in sorted(
        ((name, (m["columns"], m)) for name, m in tables.items()),
    )
]
for e in expectations:  # fix ordering nit: meta dict access
    pass

lines = [
    "/**",
    " * GENERATED by scripts/generate_schema_expectations.py - do not edit by hand.",
    " * Every table and column the migrations create. Settings -> Database check",
    " * verifies the connected Supabase project against this list and names the",
    " * migration file to run for anything missing.",
    " */",
    "export const SCHEMA_EXPECTATIONS: {",
    "  table: string;",
    "  columns: string[];",
    "  migration: string;",
    "}[] = [",
]
for e in expectations:
    cols = ", ".join(f'"{c}"' for c in e["columns"])
    lines.append(f'  {{ table: "{e["table"]}", migration: "{e["migration"]}", columns: [{cols}] }},')
lines.append("];")
open(os.path.join(ROOT, "lib/data/schema-expectations.ts"), "w").write("\n".join(lines) + "\n")
print("schema-expectations.ts:", len(expectations), "tables")

# 2. Compact fix_now.sql: migrations 0007-0011 without comments/blanks.
FIX_FILES = [f for f in sorted(os.listdir(MIG))
             if f[:4] in {"0004", "0006", "0007", "0008", "0009", "0010", "0011"}]
parts = ["-- Career Desk: fix SQL for settings, plan, documents and the AI features",
         "-- (migrations 0004-0011 in compact form, plus two core column patches).",
         "-- Paste the whole file into Supabase Dashboard -> SQL Editor -> Run.",
         "-- Safe to run more than once: every statement tolerates existing objects.",
         "-- If pages still fail afterwards with 'not found in the schema cache',",
         "-- the NOTIFY at the end fixes that: give it a few seconds, then reload.",
         "",
         "-- Core patch: created_at on the portfolio tables (added 2026-11) -",
         "-- older databases created these tables without it.",
         "alter table public.projects add column if not exists created_at timestamptz not null default now();",
         "alter table public.project_deliverables add column if not exists created_at timestamptz not null default now();",
         ""]
for f in FIX_FILES:
    sql = open(os.path.join(MIG, f)).read()
    stmts = split_statements(sql)
    parts.append(f"-- from {f}")
    def policy_id(s):
        # (name, qualified table) of a `create policy name on table ...` statement.
        # The table may be schema-qualified (storage.objects); capturing only the
        # first word used to synthesize bogus `on public.storage` drops, which
        # ERROR in Postgres (no such table) and killed the whole pasted script.
        m = re.match(
            r'(?is)^\s*create\s+policy\s+(?:"([^"]+)"|(\w+))\s+on\s+((?:(?:public|storage|auth)\.)?\w+)',
            s,
        )
        if not m:
            return None
        name = m.group(1) or m.group(2)
        table = m.group(3)
        if "." not in table:
            table = "public." + table
        return name, table

    for s in stmts:
        # Policies: drop-if-exists + create. Idempotent without dynamic SQL
        # (DO $$ begin execute '...' exception ... end $$ chokes PostgreSQL
        # 18's parser, so never use that wrapper here).
        pid = policy_id(s) if re.match(r"(?is)^\s*create\s+policy\s+", s) else None
        if pid and " or replace" not in s.lower():
            name, table = pid
            pieces = [f'drop policy if exists "{name}" on {table};', s + ";"]
        else:
            pieces = []
            for line in s.split("\n"):
                clean = re.sub(r"[ \t]+", " ", line).strip()
                if not clean:
                    continue
                pieces.append(clean)
                pieces.append("\n" if "--" in clean else " ")
            pieces = ["".join(pieces).strip() + ";"]
        parts.extend(pieces)
parts.append("")
parts.append("notify pgrst, 'reload schema';")
open(os.path.join(ROOT, "supabase/fix_now.sql"), "w").write("\n".join(parts) + "\n")
size = os.path.getsize(os.path.join(ROOT, "supabase/fix_now.sql"))
print(f"fix_now.sql: {size} bytes, {len(FIX_FILES)} migrations")

# 3. apply_all_migrations.sql: ALL migrations verbatim, same drop-if-exists
#    policy treatment. Safe to paste even after new migrations are added.
all_parts = [
    "-- Career Desk: all migrations, consolidated and idempotent.",
    "-- Safe to paste into the Supabase SQL Editor even if some migrations",
    "-- have already run: existing tables, columns and triggers are left",
    "-- alone, and policies are dropped and recreated (they hold no data).",
    "",
]
for f in sorted(os.listdir(MIG)):
    if not f.endswith(".sql"):
        continue
    all_parts.append(f"-- ======== {f} ========")
    for s in split_statements(open(os.path.join(MIG, f)).read()):
        pid = policy_id(s) if re.match(r"(?is)^\s*create\s+policy\s+", s) else None
        if pid and " or replace" not in s.lower():
            name, table = pid
            all_parts.append(f'drop policy if exists "{name}" on {table};')
            all_parts.append(s + ";")
        else:
            all_parts.append(s + ";")
    all_parts.append("")
all_parts.append("notify pgrst, 'reload schema';")
open(os.path.join(ROOT, "supabase/apply_all_migrations.sql"), "w").write(
    "\n".join(all_parts)
)
print("apply_all_migrations.sql:", os.path.getsize(os.path.join(ROOT, "supabase/apply_all_migrations.sql")), "bytes")
