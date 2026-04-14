import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { checkFsAccess } from "@/lib/fs-access";
import { getAgencyMembership } from "@/lib/fs-team";

const VALID_DOC_TYPES = ["agreement", "certificate", "invoice", "other"] as const;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function extractApiKey(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  const x = req.headers.get("x-api-key");
  return x?.trim() || null;
}

async function resolveProjectIdByName(userId: string, name: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("fs_projects")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function POST(req: NextRequest) {
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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Field 'file' is required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 });
  }

  const docType = ((formData.get("doc_type") as string) || "other").toLowerCase();
  if (!VALID_DOC_TYPES.includes(docType as typeof VALID_DOC_TYPES[number])) {
    return NextResponse.json(
      { error: `Invalid doc_type. Must be one of: ${VALID_DOC_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const expiryDate = (formData.get("expiry_date") as string) || null;
  const tagsRaw = (formData.get("tags") as string) || "";
  const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);

  let projectId: string | null = null;
  const projectIdRaw = formData.get("project_id") as string | null;
  const projectName = formData.get("project") as string | null;
  if (projectIdRaw) {
    projectId = projectIdRaw;
  } else if (projectName) {
    projectId = await resolveProjectIdByName(user.id, projectName);
    if (!projectId) {
      return NextResponse.json({ error: `Project '${projectName}' not found` }, { status: 404 });
    }
  }

  let agencyId: string | null = null;
  if ((formData.get("team") as string) === "true") {
    const membership = await getAgencyMembership(user.id);
    if (!membership) {
      return NextResponse.json({ error: "Not part of an agency" }, { status: 403 });
    }
    if (!membership.canWrite) {
      return NextResponse.json(
        { error: "Only agency owner/admin can upload shared documents" },
        { status: 403 }
      );
    }
    agencyId = membership.agencyId;
  }

  const fileId = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const storagePath = `${user.id}/${fileId}/${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from("fs-documents")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { data, error } = await admin
    .from("fs_documents")
    .insert({
      user_id: user.id,
      project_id: projectId,
      filename: file.name,
      doc_type: docType,
      expiry_date: expiryDate,
      tags,
      storage_path: storagePath,
      file_size: file.size,
      agency_id: agencyId,
    })
    .select("id, filename, doc_type, file_size, created_at")
    .single();

  if (error) {
    await admin.storage.from("fs-documents").remove([storagePath]);
    return NextResponse.json({ error: `Metadata insert failed: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ document: data, team: !!agencyId }, { status: 201 });
}
