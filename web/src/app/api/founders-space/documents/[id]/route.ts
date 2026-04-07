import { NextRequest, NextResponse } from "next/server";
import { createClient, getSupabaseAdmin } from "@/lib/supabase-server";
import { getAgencyMembership } from "@/lib/fs-team";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const admin = getSupabaseAdmin();

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

    // Fetch document metadata
    const { data: doc, error } = await admin
      .from("fs_documents")
      .select("storage_path, filename, user_id, agency_id")
      .eq("id", id)
      .single();

    if (error || !doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Authorization: own document or agency member for team documents
    if (doc.agency_id) {
      const membership = await getAgencyMembership(user.id);
      if (!membership || membership.agencyId !== doc.agency_id) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
    } else if (doc.user_id !== user.id) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const { data: signedData, error: signedError } = await admin.storage
      .from("fs-documents")
      .createSignedUrl(doc.storage_path, 3600);

    if (signedError || !signedData?.signedUrl) {
      console.error("Signed URL error:", signedError);
      return NextResponse.json(
        { error: "Failed to generate download URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: signedData.signedUrl,
      filename: doc.filename,
    });
  } catch (err) {
    console.error("Document download error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const admin = getSupabaseAdmin();

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

    const { data: doc, error: fetchError } = await admin
      .from("fs_documents")
      .select("storage_path, user_id, agency_id")
      .eq("id", id)
      .single();

    if (fetchError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Authorization
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

    const { error: storageError } = await admin.storage
      .from("fs-documents")
      .remove([doc.storage_path]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
    }

    const { error: dbError } = await admin
      .from("fs_documents")
      .delete()
      .eq("id", id);

    if (dbError) {
      console.error("Document delete error:", dbError);
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Document DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
