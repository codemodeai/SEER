import { NextRequest, NextResponse } from "next/server";
import { createClient, getSupabaseAdmin } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const admin = getSupabaseAdmin();

    // Check fs_access
    const { data: userData } = await admin
      .from("users")
      .select("fs_access")
      .eq("id", user.id)
      .single();

    if (!userData?.fs_access) {
      return NextResponse.json(
        { error: "Founder's Space access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("project_id");

    let query = admin
      .from("fs_documents")
      .select(
        "id, filename, doc_type, expiry_date, tags, file_size, created_at, project_id, fs_projects(name)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

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

    const admin = getSupabaseAdmin();

    // Check fs_access
    const { data: userData } = await admin
      .from("users")
      .select("fs_access")
      .eq("id", user.id)
      .single();

    if (!userData?.fs_access) {
      return NextResponse.json(
        { error: "Founder's Space access required" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const docType = (formData.get("doc_type") as string) || "other";
    const projectId = formData.get("project_id") as string | null;
    const expiryDate = formData.get("expiry_date") as string | null;
    const tagsRaw = formData.get("tags") as string | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Validate doc_type
    const validTypes = ["agreement", "certificate", "invoice", "other"];
    if (!validTypes.includes(docType)) {
      return NextResponse.json(
        { error: "Invalid doc_type. Must be agreement, certificate, invoice, or other" },
        { status: 400 }
      );
    }

    // Parse tags
    const tags: string[] = tagsRaw
      ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    // Generate storage path: {user_id}/{uuid}/{filename}
    const fileId = crypto.randomUUID();
    const storagePath = `${user.id}/${fileId}/${file.name}`;

    // Upload to Supabase Storage
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

    // Store metadata in database
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
      })
      .select("id, filename, doc_type, expiry_date, tags, file_size, created_at")
      .single();

    if (error) {
      console.error("Document insert error:", error);
      // Clean up uploaded file on db failure
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
