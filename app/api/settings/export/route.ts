import JSZip from "jszip";
import { requireUser } from "@/lib/data/auth";
import { dumpUserData, toCsv, EXPORT_TABLES } from "@/lib/operations/export-data";
import { rateLimit } from "@/lib/operations/rate-limit";

/**
 * GET /api/settings/export  (Prompt 24)
 * A ZIP of the owner's data: JSON and CSV for every table plus every
 * exported PDF from the private documents bucket. Own the data, keep the
 * receipts.
 */
export async function GET() {
  const { user, supabase } = await requireUser();

  const limiter = rateLimit(`export-data:${user.id}`, 3, 60_000);
  if (!limiter.ok) {
    return Response.json(
      { error: "Too many exports. Try again in a moment." },
      { status: 429 },
    );
  }

  const dump = await dumpUserData(supabase, user.id);
  const zip = new JSZip();

  for (const table of EXPORT_TABLES) {
    const rows = dump[table] ?? [];
    zip.file(`json/${table}.json`, JSON.stringify(rows, null, 2));
    zip.file(`csv/${table}.csv`, toCsv(rows));
  }

  // All generated PDFs from the private bucket.
  const { data: docs } = await supabase
    .from("application_documents")
    .select("id, pdf_path")
    .not("pdf_path", "is", null);
  for (const doc of docs ?? []) {
    const path = doc.pdf_path as string;
    const { data } = await supabase.storage.from("documents").download(path);
    if (data) {
      zip.file(`pdfs/${path.split("/").pop() ?? doc.id}`, await data.arrayBuffer());
    }
  }

  const readme = [
    "Career Desk data export",
    `Generated: ${new Date().toISOString()}`,
    "",
    "json/  - every table as JSON (the restore source; see scripts/restore_backup.mjs)",
    "csv/   - every table as CSV, opens in Excel",
    "pdfs/  - every exported CV and cover letter PDF, exactly as sent",
    "",
    "To restore: create a fresh Supabase project, run supabase/migrations in",
    "order, then node scripts/restore_backup.mjs <project-url> <service-key> json/",
    "Row counts and a sample PDF download are part of the restore procedure",
    "in the README.",
  ].join("\n");
  zip.file("README.txt", readme);

  const content = await zip.generateAsync({ type: "nodebuffer" });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(content as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="career-desk-export-${date}.zip"`,
    },
  });
}
