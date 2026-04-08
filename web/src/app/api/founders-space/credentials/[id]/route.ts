import { NextRequest, NextResponse } from "next/server";
import { createClient, getSupabaseAdmin } from "@/lib/supabase-server";
import { decrypt } from "@/lib/encryption";
import { getAgencyMembership } from "@/lib/fs-team";
import { checkFsAccess } from "@/lib/fs-access";

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

    if (!(await checkFsAccess(user.id))) {
      return NextResponse.json(
        { error: "Founder's Space access required" },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    // Fetch the credential
    const { data: cred, error } = await admin
      .from("fs_credentials")
      .select("value_encrypted, iv, auth_tag, user_id, agency_id")
      .eq("id", id)
      .single();

    if (error || !cred) {
      return NextResponse.json(
        { error: "Credential not found" },
        { status: 404 }
      );
    }

    // Authorization: own credential or agency owner/admin for team credentials
    if (cred.agency_id) {
      const membership = await getAgencyMembership(user.id);
      if (!membership || membership.agencyId !== cred.agency_id || !membership.canWrite) {
        return NextResponse.json(
          { error: "Only agency owner/admin can reveal shared credentials" },
          { status: 403 }
        );
      }
    } else if (cred.user_id !== user.id) {
      return NextResponse.json(
        { error: "Credential not found" },
        { status: 404 }
      );
    }

    const plaintext = await decrypt(cred.value_encrypted, cred.iv, cred.auth_tag);

    await admin
      .from("fs_credentials")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ value: plaintext });
  } catch (err) {
    console.error("Credential reveal error:", err);
    return NextResponse.json(
      { error: "Failed to decrypt credential" },
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

    if (!(await checkFsAccess(user.id))) {
      return NextResponse.json(
        { error: "Founder's Space access required" },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    // Check ownership
    const { data: cred } = await admin
      .from("fs_credentials")
      .select("user_id, agency_id")
      .eq("id", id)
      .single();

    if (!cred) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    if (cred.agency_id) {
      const membership = await getAgencyMembership(user.id);
      if (!membership || membership.agencyId !== cred.agency_id || !membership.canWrite) {
        return NextResponse.json(
          { error: "Only agency owner/admin can delete shared credentials" },
          { status: 403 }
        );
      }
    } else if (cred.user_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { error } = await admin
      .from("fs_credentials")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Credential delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete credential" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Credential DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
