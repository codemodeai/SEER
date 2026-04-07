import { NextRequest, NextResponse } from "next/server";
import { createClient, getSupabaseAdmin } from "@/lib/supabase-server";
import { getAgencyMembership } from "@/lib/fs-team";

async function checkAccess(userId: string) {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("users")
    .select("fs_access")
    .eq("id", userId)
    .single();
  return data?.fs_access === true;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (!(await checkAccess(user.id))) {
      return NextResponse.json({ error: "Founder's Space access required" }, { status: 403 });
    }

    const projectId = req.nextUrl.searchParams.get("project_id");
    const team = req.nextUrl.searchParams.get("team") === "true";
    const admin = getSupabaseAdmin();

    if (team) {
      // Team mode — fetch tasks shared with the user's agency
      const membership = await getAgencyMembership(user.id);
      if (!membership) {
        return NextResponse.json({ error: "Not part of an agency" }, { status: 403 });
      }

      let query = admin
        .from("fs_tasks")
        .select("*, fs_projects(name), users!fs_tasks_user_id_fkey(email)")
        .eq("agency_id", membership.agencyId)
        .order("created_at", { ascending: false });

      if (projectId) query = query.eq("project_id", projectId);

      const { data: tasks, error } = await query;
      if (error) {
        console.error("Team tasks fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch team tasks" }, { status: 500 });
      }

      return NextResponse.json({ tasks: tasks ?? [], team: true });
    }

    // Personal mode
    let query = admin
      .from("fs_tasks")
      .select("*")
      .eq("user_id", user.id)
      .is("agency_id", null)
      .order("created_at", { ascending: false });

    if (projectId) query = query.eq("project_id", projectId);

    const { data: tasks, error } = await query;
    if (error) {
      console.error("Tasks fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }

    return NextResponse.json({ tasks: tasks ?? [] });
  } catch (err) {
    console.error("Tasks fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (!(await checkAccess(user.id))) {
      return NextResponse.json({ error: "Founder's Space access required" }, { status: 403 });
    }

    const body = await req.json();
    const { title, project_id, due_date, status, team } = body as {
      title: string;
      project_id?: string;
      due_date?: string;
      status?: string;
      team?: boolean;
    };

    if (!title?.trim()) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }

    const validStatuses = ["open", "in_progress", "done", "blocked"];
    const taskStatus = status && validStatuses.includes(status) ? status : "open";

    let agencyId: string | null = null;
    if (team) {
      const membership = await getAgencyMembership(user.id);
      if (!membership) {
        return NextResponse.json({ error: "Not part of an agency" }, { status: 403 });
      }
      agencyId = membership.agencyId;
    }

    const admin = getSupabaseAdmin();
    const { data: task, error } = await admin
      .from("fs_tasks")
      .insert({
        user_id: user.id,
        title: title.trim(),
        project_id: project_id || null,
        due_date: due_date || null,
        status: taskStatus,
        created_via: "dashboard",
        agency_id: agencyId,
      })
      .select()
      .single();

    if (error) {
      console.error("Task create error:", error);
      return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }

    return NextResponse.json({ task });
  } catch (err) {
    console.error("Task create error:", err);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
