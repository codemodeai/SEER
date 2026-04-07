import { NextRequest, NextResponse } from "next/server";
import { createClient, getSupabaseAdmin } from "@/lib/supabase-server";
import { encrypt } from "@/lib/encryption";
import { getAgencyMembership } from "@/lib/fs-team";

export async function GET(req: NextRequest) {
  try {
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

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("project_id");
    const team = searchParams.get("team") === "true";

    if (team) {
      const membership = await getAgencyMembership(user.id);
      if (!membership) {
        return NextResponse.json({ error: "Not part of an agency" }, { status: 403 });
      }

      let query = admin
        .from("fs_credentials")
        .select(
          "id, label, environment, project_id, created_at, last_used_at, fs_projects(name), user_id, users!fs_credentials_user_id_fkey(email)"
        )
        .eq("agency_id", membership.agencyId)
        .order("created_at", { ascending: false });

      if (projectId) query = query.eq("project_id", projectId);

      const { data, error } = await query;
      if (error) {
        console.error("Team credentials list error:", error);
        return NextResponse.json({ error: "Failed to fetch team credentials" }, { status: 500 });
      }

      return NextResponse.json({ credentials: data, team: true, canWrite: membership.canWrite });
    }

    // Personal mode
    let query = admin
      .from("fs_credentials")
      .select(
        "id, label, environment, project_id, created_at, last_used_at, fs_projects(name)"
      )
      .eq("user_id", user.id)
      .is("agency_id", null)
      .order("created_at", { ascending: false });

    if (projectId) query = query.eq("project_id", projectId);

    const { data, error } = await query;

    if (error) {
      console.error("Credentials list error:", error);
      return NextResponse.json(
        { error: "Failed to fetch credentials" },
        { status: 500 }
      );
    }

    return NextResponse.json({ credentials: data });
  } catch (err) {
    console.error("Credentials GET error:", err);
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

    const body = await req.json();
    const { label, value, project_id, environment, team } = body;

    if (!label || !value) {
      return NextResponse.json(
        { error: "Label and value are required" },
        { status: 400 }
      );
    }

    const validEnvs = ["development", "staging", "production"];
    if (environment && !validEnvs.includes(environment)) {
      return NextResponse.json(
        { error: "Invalid environment. Must be development, staging, or production" },
        { status: 400 }
      );
    }

    let agencyId: string | null = null;
    if (team) {
      const membership = await getAgencyMembership(user.id);
      if (!membership) {
        return NextResponse.json({ error: "Not part of an agency" }, { status: 403 });
      }
      if (!membership.canWrite) {
        return NextResponse.json({ error: "Only agency owner/admin can create shared credentials" }, { status: 403 });
      }
      agencyId = membership.agencyId;
    }

    const encrypted = await encrypt(value);

    const { data, error } = await admin
      .from("fs_credentials")
      .insert({
        user_id: user.id,
        label,
        value_encrypted: encrypted.encrypted,
        iv: encrypted.iv,
        auth_tag: encrypted.authTag,
        project_id: project_id || null,
        environment: environment || "production",
        agency_id: agencyId,
      })
      .select("id, label, environment, project_id, created_at")
      .single();

    if (error) {
      console.error("Credential create error:", error);
      return NextResponse.json(
        { error: "Failed to create credential" },
        { status: 500 }
      );
    }

    return NextResponse.json({ credential: data }, { status: 201 });
  } catch (err) {
    console.error("Credentials POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
