#!/usr/bin/env node
/**
 * Career Desk - RLS end-to-end test.
 *
 * Creates two throwaway users through the real Supabase Auth API, then checks
 * through the real REST and Storage APIs that:
 *   1. each user can create and read their own rows,
 *   2. neither user can see, modify or delete the other user's rows,
 *   3. the anonymous (signed-out) role can see nothing,
 *   4. Storage: a user cannot read another user's files in the private
 *      "documents" bucket, and cannot write outside their own folder.
 *
 * Run on a TEST project (throwaway users are created):
 *   node supabase/tests/rls-test.mjs https://<project>.supabase.co <anon-key>
 *
 * Email confirmation must be OFF for throwaway signups
 * (Authentication -> Providers -> Email -> "Confirm email" off), or pass two
 * existing user access tokens instead:
 *   RLS_TOKEN_A=... RLS_TOKEN_B=... node supabase/tests/rls-test.mjs <url> <anon>
 */

const [, , urlArg, keyArg] = process.argv;
const url = (urlArg || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const anonKey = keyArg || process.env.SUPABASE_ANON_KEY || "";

if (!url || !anonKey) {
  console.error(
    "Usage: node rls-test.mjs https://<project>.supabase.co <anon-key>",
  );
  process.exit(1);
}

let pass = 0;
let fail = 0;

function check(name, ok, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}${detail ? `  (${detail})` : ""}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}${detail ? `  (${detail})` : ""}`);
  }
}

function rest(path, token, options = {}) {
  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
}

async function restJson(path, token, options) {
  const res = await rest(path, token, options);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function signUp(label) {
  const email = `rls-test-${label}-${Date.now()}@example.com`;
  const res = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: `RlsTest-${label}-${Date.now()}!` }),
  });
  const body = await res.json();
  if (!body.access_token || !body.user?.id) {
    console.error(
      `Could not create throwaway user ${email}. Is email confirmation off on this test project? Response:`,
      JSON.stringify(body).slice(0, 300),
    );
    process.exit(1);
  }
  return { token: body.access_token, userId: body.user.id };
}

async function main() {
  console.log(`Testing ${url}\n`);

  let tokenA = process.env.RLS_TOKEN_A;
  let tokenB = process.env.RLS_TOKEN_B;
  let userIdA;

  if (!tokenA || !tokenB) {
    console.log("Creating two throwaway users...");
    const a = await signUp("a");
    const b = await signUp("b");
    tokenA = a.token;
    userIdA = a.userId;
    tokenB = b.token;
  } else {
    console.log("Using access tokens from environment.");
  }

  // 1. User A creates a job and reads it back.
  const { status: insStatus, body: insBody } = await restJson("jobs", tokenA, {
    method: "POST",
    body: JSON.stringify({
      user_id: userIdA,
      title: "RLS test job",
      company: "Secret Co",
      description: "Only user A may see this.",
    }),
  });
  check("user A can insert a job", insStatus === 201, `status ${insStatus}`);
  const jobId = insBody?.[0]?.id;

  const { body: ownJobs } = await restJson("jobs?id=eq." + jobId, tokenA);
  check("user A can read own job", ownJobs?.length === 1);

  // 2. User B sees nothing of user A's.
  const { body: bAll } = await restJson("jobs?select=id", tokenB);
  check(
    "user B sees zero jobs",
    bAll?.length === 0,
    `got ${bAll?.length ?? "error"}`,
  );
  const { body: bById } = await restJson("jobs?id=eq." + jobId, tokenB);
  check("user B cannot read user A's job by id", bById?.length === 0);

  // 3. User B cannot modify or delete user A's job.
  const { body: bUpd } = await restJson("jobs?id=eq." + jobId, tokenB, {
    method: "PATCH",
    body: JSON.stringify({ status: "closed" }),
  });
  check("user B cannot update user A's job", bUpd?.length === 0);
  const { body: bDel } = await restJson("jobs?id=eq." + jobId, tokenB, {
    method: "DELETE",
  });
  check("user B cannot delete user A's job", bDel?.length === 0);

  // 4. status_history was written by the trigger for user A's job, and is
  //    visible only to user A.
  const { body: histA } = await restJson(
    `status_history?job_id=eq.${jobId}&select=id`,
    tokenA,
  );
  check(
    "status_history trigger wrote user A's row",
    histA?.length === 1,
    `got ${histA?.length ?? 0}`,
  );
  const { body: histB } = await restJson(
    `status_history?job_id=eq.${jobId}&select=id`,
    tokenB,
  );
  check("user B sees zero status_history rows", histB?.length === 0);

  // 5. Anonymous (signed out) sees nothing.
  const anonToken = anonKey; // anon key acts as the anon role
  const { body: anonJobs } = await restJson("jobs?select=id", anonToken);
  check("anonymous role sees zero jobs", anonJobs?.length === 0);

  // 6. Storage: user A uploads into their own folder; user B cannot read it
  //    and cannot write into user A's folder.
  const folderA = userIdA;
  const objectPath = `${folderA}/rls-test-${Date.now()}.txt`;

  const upRes = await fetch(
    `${url}/storage/v1/object/documents/${objectPath}`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": "text/plain",
        "x-upsert": "false",
      },
      body: "private cv content for user A",
    },
  );
  check("user A can upload to own documents folder", upRes.status === 200, `status ${upRes.status}`);

  const readB = await fetch(`${url}/storage/v1/object/documents/${objectPath}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${tokenB}` },
  });
  check(
    "user B cannot read user A's document",
    !readB.ok,
    `status ${readB.status}`,
  );

  const writeB = await fetch(
    `${url}/storage/v1/object/documents/${folderA}/injected-${Date.now()}.txt`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${tokenB}`,
        "Content-Type": "text/plain",
      },
      body: "user B should not be able to write here",
    },
  );
  check(
    "user B cannot write into user A's documents folder",
    !writeB.ok,
    `status ${writeB.status}`,
  );

  const readA = await fetch(`${url}/storage/v1/object/documents/${objectPath}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${tokenA}` },
  });
  check("user A can read own document back", readA.ok, `status ${readA.status}`);

  // Clean up the uploaded object so the test is repeatable.
  if (upRes.status === 200) {
    await fetch(`${url}/storage/v1/object/documents/${objectPath}`, {
      method: "DELETE",
      headers: { apikey: anonKey, Authorization: `Bearer ${tokenA}` },
    });
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test run failed:", err.message);
  process.exit(1);
});
