import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { checkFsAccess } from "@/lib/fs-access";
import { getAgencyMembership } from "@/lib/fs-team";

function extractApiKey(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  const x = req.headers.get("x-api-key");
  return x?.trim() || null;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = extractApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "Missing Authorization: Bearer sk-seer-..." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: user } = await admin
    .from("users")
    .select("id")
    .eq("seer_api_key", apiKey)
    .single();
  if (!user) {
    return NextResponse.json({ error: "Invalid SEER API key" }, { status: 401 });
  }

  if (!(await checkFsAccess(user.id))) {
    return NextResponse.json({ error: "Founder's Space access required" }, { status: 403 });
  }

  const { id } = await params;

  const { data: doc, error: fetchError } = await admin
    .from("fs_documents")
    .select("storage_path, user_id, agency_id, filename")
    .eq("id", id)
    .single();

  if (fetchError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (doc.agency_id) {
    const membership = await getAgencyMembership(user.id);
    if (!membership || membership.agencyId !== doc.agency_id || !membership.canWrite) {
      return NextResponse.json(
        { error: "Only agency owner/admin can delete shared documents" },
        { status: 403 }
      );
    }
  } else if (doc.user_id !== user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await admin.storage.from("fs-documents").remove([doc.storage_path]);

  const { error: dbError } = await admin
    .from("fs_documents")
    .delete()
    .eq("id", id);

  if (dbError) {
    return NextResponse.json({ error: `Delete failed: ${dbError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted: { id, filename: doc.filename } });
}
