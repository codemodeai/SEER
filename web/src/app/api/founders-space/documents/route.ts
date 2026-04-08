import { NextRequest, NextResponse } from "next/server";
import { createClient, getSupabaseAdmin } from "@/lib/supabase-server";
import { getAgencyMembership } from "@/lib/fs-team";
import { checkFsAccess } from "@/lib/fs-access";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (!(await checkFsAccess(user.id))) {
      return NextResponse.json(
        { error: "Founder's Space access required" },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("project_id");
    const team = searchParams.get("team") === "true";

    if (team) {
      const membership = await getAgencyMembership(user.id);
      if (!membership) {
        return NextResponse.json({ error: "Not part of an agency" }, { status: 403 });
      }

      let query = admin
        .from("fs_documents")
        .select(
          "id, filename, doc_type, expiry_date, tags, file_size, created_at, project_id, fs_projects(name), user_id, users!fs_documents_user_id_fkey(email)"
        )
        .eq("agency_id", membership.agencyId)
        .order("created_at", { ascending: false });

      if (projectId) query = query.eq("project_id", projectId);

      const { data, error } = await query;
      if (error) {
        console.error("Team documents list error:", error);
        return NextResponse.json({ error: "Failed to fetch team documents" }, { status: 500 });
      }

      return NextResponse.json({ documents: data, team: true, canWrite: membership.canWrite });
    }

    let query = admin
      .from("fs_documents")
      .select(
        "id, filename, doc_type, expiry_date, tags, file_size, created_at, project_id, fs_projects(name)"
      )
      .eq("user_id", user.id)
      .is("agency_id", null)
      .order("created_at", { ascending: false });

    if (projectId) query = query.eq("project_id", projectId);

    const { data, error } = await query;

    if (error) {
      console.error("Documents list error:", error);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    return NextResponse.json({ documents: data });
  } catch (err) {
    console.error("Documents GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (!(await checkFsAccess(user.id))) {
      return NextResponse.json(
        { error: "Founder's Space access required" },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const docType = (formData.get("doc_type") as string) || "other";
    const projectId = formData.get("project_id") as string | null;
    const expiryDate = formData.get("expiry_date") as string | null;
    const tagsRaw = formData.get("tags") as string | null;
    const teamFlag = formData.get("team") as string | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File exceeds 10MB limit" },
        { status: 400 }
      );
    }

    const validTypes = ["agreement", "certificate", "invoice", "other"];
    if (!validTypes.includes(docType)) {
      return NextResponse.json(
        { error: "Invalid doc_type. Must be agreement, certificate, invoice, or other" },
        { status: 400 }
      );
    }

    const tags: string[] = tagsRaw
      ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    let agencyId: string | null = null;
    if (teamFlag === "true") {
      const membership = await getAgencyMembership(user.id);
      if (!membership) {
        return NextResponse.json({ error: "Not part of an agency" }, { status: 403 });
      }
      if (!membership.canWrite) {
        return NextResponse.json({ error: "Only agency owner/admin can upload shared documents" }, { status: 403 });
      }
      agencyId = membership.agencyId;
    }

    const fileId = crypto.randomUUID();
    const storagePath = `${user.id}/${fileId}/${file.name}`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from("fs-documents")
      .upload(storagePath, fileBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    const { data, error } = await admin
      .from("fs_documents")
      .insert({
        user_id: user.id,
        project_id: projectId || null,
        filename: file.name,
        doc_type: docType,
        expiry_date: expiryDate || null,
        tags,
        storage_path: storagePath,
        file_size: file.size,
        agency_id: agencyId,
      })
      .select("id, filename, doc_type, expiry_date, tags, file_size, created_at")
      .single();

    if (error) {
      console.error("Document insert error:", error);
      await admin.storage.from("fs-documents").remove([storagePath]);
      return NextResponse.json(
        { error: "Failed to save document metadata" },
        { status: 500 }
      );
    }

    return NextResponse.json({ document: data }, { status: 201 });
  } catch (err) {
    console.error("Documents POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
