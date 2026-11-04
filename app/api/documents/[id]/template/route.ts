import { NextResponse } from "next/server";
import { requireUser } from "@/lib/data/auth";
import { getDocument, updateDocumentDraft } from "@/lib/data/queries/documents";
import { DOCUMENT_TEMPLATES, type DocumentTemplate } from "@/lib/data/types";

/**
 * PUT /api/documents/[id]/template
 * Saves which PDF base template ("BI and commercial" / "Risk and research")
 * this version uses. Drafts only: approved versions are locked.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase } = await requireUser();
  const { id } = await params;

  const document = await getDocument(supabase, id);
  if (!document || document.user_id !== user.id) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  if (document.status !== "draft") {
    return NextResponse.json(
      { error: "Approved versions are locked. Create a new version first." },
      { status: 400 },
    );
  }

  let body: { template?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const template = body.template as DocumentTemplate;
  if (!DOCUMENT_TEMPLATES.includes(template)) {
    return NextResponse.json({ error: "Unknown template." }, { status: 400 });
  }

  const updated = await updateDocumentDraft(supabase, id, { template });
  return NextResponse.json({ document: updated });
}
