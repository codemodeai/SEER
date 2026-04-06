import { NextRequest, NextResponse } from "next/server";
import { createClient, getSupabaseAdmin } from "@/lib/supabase-server";
import { decrypt } from "@/lib/encryption";

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

    // Fetch the credential (must belong to user)
    const { data: cred, error } = await admin
      .from("fs_credentials")
      .select("value_encrypted, iv, auth_tag")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !cred) {
      return NextResponse.json(
        { error: "Credential not found" },
        { status: 404 }
      );
    }

    // Decrypt the value
    const plaintext = await decrypt(cred.value_encrypted, cred.iv, cred.auth_tag);

    // Update last_used_at
    await admin
      .from("fs_credentials")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

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

    const { error } = await admin
      .from("fs_credentials")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

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
