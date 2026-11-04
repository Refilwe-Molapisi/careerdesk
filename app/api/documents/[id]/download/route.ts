import { NextResponse } from "next/server";
import { requireUser } from "@/lib/data/auth";
import { getDocument } from "@/lib/data/queries/documents";

/**
 * GET /api/documents/[id]/download
 * Redirects to a short-lived signed URL for the exported PDF. The document
 * must belong to the caller; the signed URL expires in 60 seconds.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supabase } = await requireUser();
  const { id } = await params;

  const document = await getDocument(supabase, id);
  if (!document || document.user_id !== user.id) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  if (!document.pdf_path) {
    return NextResponse.json(
      { error: "This version has no exported PDF yet." },
      { status: 404 },
    );
  }

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(document.pdf_path, 60);
  if (error || !data?.signedUrl) {
    console.error("signed url failed:", error?.message);
    return NextResponse.json(
      { error: "Could not create a download link. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(data.signedUrl);
}
