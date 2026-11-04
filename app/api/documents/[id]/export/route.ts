import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requireUser } from "@/lib/data/auth";
import { getJob } from "@/lib/data/queries/jobs";
import { getDocument, updateDocumentDraft } from "@/lib/data/queries/documents";
import { getUserSettings } from "@/lib/data/queries/career";
import {
  coverLetterContentSchema,
  cvContentSchema,
} from "@/lib/operations/document-parts";
import {
  renderCoverLetterPdf,
  renderCvPdf,
} from "@/lib/operations/pdf/templates";
import { rateLimit } from "@/lib/operations/rate-limit";
import type { DocumentTemplate } from "@/lib/data/types";

/**
 * POST /api/documents/[id]/export
 * Renders the approved/draft document to PDF with the chosen template,
 * stores it in the private documents bucket under the user's folder as
 * Firstname-Surname_Company_Role_vN.pdf, and records the storage path and
 * SHA-256 hash on the document row.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase } = await requireUser();
  const { id } = await params;

  const limiter = rateLimit(`export:${user.id}`, 20, 60_000);
  if (!limiter.ok) {
    return NextResponse.json(
      { error: "Too many exports. Try again in a moment." },
      { status: 429 },
    );
  }

  const document = await getDocument(supabase, id);
  if (!document || document.user_id !== user.id) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const job = await getJob(supabase, document.job_id);
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const parsed =
    document.kind === "cv"
      ? cvContentSchema.safeParse(document.content_json)
      : coverLetterContentSchema.safeParse(document.content_json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "This version's content is incomplete and cannot be exported." },
      { status: 400 },
    );
  }

  const settings = await getUserSettings(supabase, user.id);
  const fullName = settings?.full_name?.trim() || "Career Desk User";
  const template = (document.template as DocumentTemplate) ?? "bi_commercial";

  const meta = {
    fullName,
    contactLine: user.email ?? "",
    jobTitle: job.title ?? "Role",
    company: job.company ?? "Company",
  };

  let pdf: Buffer;
  try {
    pdf =
      document.kind === "cv"
        ? await renderCvPdf(parsed.data as never, meta, template)
        : await renderCoverLetterPdf(parsed.data as never, meta, template);
  } catch (err) {
    console.error(
      "pdf render failed:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { error: "The PDF could not be generated. Try again." },
      { status: 500 },
    );
  }

  const slug = (value: string) =>
    value
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "Document";

  const folder = document.kind === "cv" ? "cv" : "cover_letter";
  const fileName = `${slug(fullName)}_${slug(meta.company)}_${slug(meta.jobTitle)}_v${document.version}.pdf`;
  const path = `${user.id}/${folder}/${fileName}`;
  const sha256 = createHash("sha256").update(pdf).digest("hex");

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadError) {
    console.error("pdf upload failed:", uploadError.message);
    return NextResponse.json(
      { error: "The PDF could not be stored. Try again." },
      { status: 500 },
    );
  }

  await updateDocumentDraft(supabase, document.id, {
    pdf_path: path,
    pdf_sha256: sha256,
  });

  return NextResponse.json({ pdf_path: path, pdf_sha256: sha256 });
}
