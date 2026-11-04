import "server-only";
import dns from "node:dns/promises";
import net from "node:net";

/**
 * Server-only tool: fetch a public web page as text (Prompt 13). The model
 * never calls tools itself; the server fetches and passes the text in marked
 * as untrusted data.
 *
 * Limits: https only, 15s timeout, 500 KB response cap, and every resolved
 * IP is checked against private/internal ranges before the request is made.
 */

const MAX_BYTES = 500_000;
const TIMEOUT_MS = 15_000;

export class FetchBlockedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "FetchBlockedError";
  }
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) {
    return true;
  }
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (/^localhost$/i.test(hostname) || hostname.endsWith(".localhost")) {
    throw new FetchBlockedError("Localhost is not a public page.");
  }
  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new FetchBlockedError("The host could not be resolved.");
  }
  if (addresses.length === 0) {
    throw new FetchBlockedError("The host could not be resolved.");
  }
  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new FetchBlockedError("Private or internal addresses are not fetched.");
    }
  }
}

/** Very small HTML-to-text: strips scripts/styles/tags and decodes entities. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchPublicPage(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new FetchBlockedError("That is not a valid URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new FetchBlockedError("Only https pages are fetched.");
  }
  await assertPublicHost(parsed.hostname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(parsed, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "CareerDesk/1.0 (+public page fetch for the owner)" },
    });
    if (!res.ok) {
      throw new FetchBlockedError(`The page returned ${res.status}.`);
    }
    const reader = res.body?.getReader();
    if (!reader) return "";
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    return htmlToText(text).slice(0, MAX_BYTES / 2);
  } catch (err) {
    if (err instanceof FetchBlockedError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new FetchBlockedError("The page took too long to load.");
    }
    throw new FetchBlockedError("The page could not be fetched.");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Web search is only wired when a search API key is configured; without one
 * it fails loudly instead of pretending to search.
 */
export async function searchWeb(): Promise<string> {
  throw new Error(
    "No search API key is configured, so web search is unavailable. Paste the source text instead.",
  );
}
