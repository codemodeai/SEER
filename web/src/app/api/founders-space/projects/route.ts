import { NextRequest, NextResponse } from "next/server";
import { createClient, getSupabaseAdmin } from "@/lib/supabase-server";
import { getAgencyMembership } from "@/lib/fs-team";
import { checkFsAccess } from "@/lib/fs-access";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (!(await checkFsAccess(user.id))) {
      return NextResponse.json({ error: "Founder's Space access required" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const team = req.nextUrl.searchParams.get("team") === "true";

    if (team) {
      const membership = await getAgencyMembership(user.id);
      if (!membership) {
        return NextResponse.json({ error: "Not part of an agency" }, { status: 403 });
      }

      const { data: projects, error } = await admin
        .from("fs_projects")
        .select("*")
        .eq("agency_id", membership.agencyId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Team projects fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
      }

      return NextResponse.json({ projects: projects ?? [], canWrite: membership.canWrite });
    }

    // Personal projects
    const { data: projects, error } = await admin
      .from("fs_projects")
      .select("*")
      .eq("user_id", user.id)
      .is("agency_id", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Projects fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }

    return NextResponse.json({ projects: projects ?? [] });
  } catch (err) {
    console.error("Projects fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (!(await checkFsAccess(user.id))) {
      return NextResponse.json({ error: "Founder's Space access required" }, { status: 403 });
    }

    const body = await req.json();
    const { name, team } = body as { name: string; team?: boolean };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    if (team) {
      const membership = await getAgencyMembership(user.id);
      if (!membership) {
        return NextResponse.json({ error: "Not part of an agency" }, { status: 403 });
      }
      if (!membership.canWrite) {
        return NextResponse.json({ error: "Only owner/admin can create team projects" }, { status: 403 });
      }

      const { data: project, error } = await admin
        .from("fs_projects")
        .insert({ user_id: user.id, name: name.trim(), agency_id: membership.agencyId })
        .select()
        .single();

      if (error) {
        console.error("Team project create error:", error);
        return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
      }

      return NextResponse.json({ project });
    }

    // Personal project
    const { data: project, error } = await admin
      .from("fs_projects")
      .insert({ user_id: user.id, name: name.trim() })
      .select()
      .single();

    if (error) {
      console.error("Project create error:", error);
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }

    return NextResponse.json({ project });
  } catch (err) {
    console.error("Project create error:", err);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
