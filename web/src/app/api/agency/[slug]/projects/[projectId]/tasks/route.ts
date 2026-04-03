import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";

async function getAgencyAccess(slug: string, userId: string) {
  const admin = getSupabaseAdmin();
  const { data: agency } = await admin
    .from("agencies")
    .select("id, owner_id")
    .eq("slug", slug)
    .single();

  if (!agency) return null;

  const isOwner = agency.owner_id === userId;
  if (isOwner) return { agency, role: "owner" as const };

  const { data: membership } = await admin
    .from("agency_users")
    .select("role")
    .eq("agency_id", agency.id)
    .eq("user_id", userId)
    .single();

  if (!membership) return null;
  return { agency, role: membership.role as "admin" | "member" };
}

async function authenticate() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// GET /api/agency/[slug]/projects/[projectId]/tasks — list tasks for a project
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; projectId: string }> }
) {
  try {
    const { slug, projectId } = await params;
    const user = await authenticate();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const access = await getAgencyAccess(slug, user.id);
    if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const admin = getSupabaseAdmin();

    // Verify project belongs to agency
    const { data: project } = await admin
      .from("agency_pm_projects")
      .select("id, name, description, status, priority, start_date, due_date, created_by, created_at")
      .eq("id", projectId)
      .eq("agency_id", access.agency.id)
      .single();

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Fetch tasks
    const { data: tasks } = await admin
      .from("agency_pm_tasks")
      .select("id, title, description, status, priority, assigned_to, created_by, due_date, position, created_at, updated_at")
      .eq("project_id", projectId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });

    // Get user emails for assignees and creators
    const userIds = new Set<string>();
    for (const t of tasks ?? []) {
      if (t.assigned_to) userIds.add(t.assigned_to);
      if (t.created_by) userIds.add(t.created_by);
    }
    if (project.created_by) userIds.add(project.created_by);

    const { data: users } = userIds.size > 0
      ? await admin.from("users").select("id, email").in("id", [...userIds])
      : { data: [] };

    const userMap: Record<string, string> = {};
    for (const u of users ?? []) userMap[u.id] = u.email;

    // Get comment counts per task
    const taskIds = (tasks ?? []).map((t: any) => t.id);
    let commentCounts: Record<string, number> = {};
    if (taskIds.length > 0) {
      const { data: comments } = await admin
        .from("agency_pm_comments")
        .select("task_id")
        .in("task_id", taskIds);

      for (const c of comments ?? []) {
        commentCounts[c.task_id] = (commentCounts[c.task_id] ?? 0) + 1;
      }
    }

    const enrichedTasks = (tasks ?? []).map((t: any) => ({
      ...t,
      assigneeEmail: t.assigned_to ? userMap[t.assigned_to] ?? null : null,
      creatorEmail: userMap[t.created_by] ?? "Unknown",
      commentCount: commentCounts[t.id] ?? 0,
    }));

    // Get agency members for assignment dropdown
    const { data: members } = await admin
      .from("agency_users")
      .select("user_id, role, users!agency_users_user_id_fkey(email)")
      .eq("agency_id", access.agency.id);

    // Also include owner
    const { data: ownerData } = await admin
      .from("agencies")
      .select("owner_id, users!agencies_owner_id_fkey(email)")
      .eq("id", access.agency.id)
      .single();

    const memberList = [
      ...(ownerData ? [{ userId: ownerData.owner_id, email: (ownerData as any).users?.email ?? "", role: "owner" }] : []),
      ...(members ?? []).map((m: any) => ({
        userId: m.user_id,
        email: m.users?.email ?? "",
        role: m.role,
      })),
    ];

    return NextResponse.json({
      project: { ...project, creatorEmail: userMap[project.created_by] ?? "Unknown" },
      tasks: enrichedTasks,
      members: memberList,
    });
  } catch (err) {
    console.error("Tasks GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/agency/[slug]/projects/[projectId]/tasks — create a task
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; projectId: string }> }
) {
  try {
    const { slug, projectId } = await params;
    const user = await authenticate();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const access = await getAgencyAccess(slug, user.id);
    if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const body = await req.json();
    const title = (body.title ?? "").trim();
    if (!title || title.length > 300) {
      return NextResponse.json({ error: "Title is required (max 300 characters)" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Verify project
    const { data: project } = await admin
      .from("agency_pm_projects")
      .select("id")
      .eq("id", projectId)
      .eq("agency_id", access.agency.id)
      .single();

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Get max position for the target status column
    const status = body.status ?? "todo";
    const { data: lastTask } = await admin
      .from("agency_pm_tasks")
      .select("position")
      .eq("project_id", projectId)
      .eq("status", status)
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const { data: task, error: insertErr } = await admin
      .from("agency_pm_tasks")
      .insert({
        project_id: projectId,
        agency_id: access.agency.id,
        title,
        description: (body.description ?? "").trim(),
        status,
        priority: body.priority ?? "medium",
        assigned_to: body.assignedTo || null,
        created_by: user.id,
        due_date: body.dueDate || null,
        position: (lastTask?.position ?? 0) + 1,
      })
      .select()
      .single();

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    console.error("Tasks POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH /api/agency/[slug]/projects/[projectId]/tasks — update a task
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; projectId: string }> }
) {
  try {
    const { slug, projectId } = await params;
    const user = await authenticate();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const access = await getAgencyAccess(slug, user.id);
    if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const body = await req.json();
    const { task_id } = body;
    if (!task_id) return NextResponse.json({ error: "task_id required" }, { status: 400 });

    const updates: Record<string, any> = {};
    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title || title.length > 300) return NextResponse.json({ error: "Invalid title" }, { status: 400 });
      updates.title = title;
    }
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined && ["todo", "in_progress", "in_review", "done"].includes(body.status)) updates.status = body.status;
    if (body.priority !== undefined && ["low", "medium", "high", "urgent"].includes(body.priority)) updates.priority = body.priority;
    if (body.assignedTo !== undefined) updates.assigned_to = body.assignedTo || null;
    if (body.dueDate !== undefined) updates.due_date = body.dueDate || null;
    if (body.position !== undefined) updates.position = body.position;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error: updateErr } = await admin
      .from("agency_pm_tasks")
      .update(updates)
      .eq("id", task_id)
      .eq("project_id", projectId)
      .eq("agency_id", access.agency.id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Tasks PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/agency/[slug]/projects/[projectId]/tasks — delete a task
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; projectId: string }> }
) {
  try {
    const { slug, projectId } = await params;
    const user = await authenticate();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const access = await getAgencyAccess(slug, user.id);
    if (!access || access.role === "member") {
      return NextResponse.json({ error: "Only owner/admin can delete tasks" }, { status: 403 });
    }

    const taskId = req.nextUrl.searchParams.get("task_id");
    if (!taskId) return NextResponse.json({ error: "task_id required" }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { error: deleteErr } = await admin
      .from("agency_pm_tasks")
      .delete()
      .eq("id", taskId)
      .eq("project_id", projectId)
      .eq("agency_id", access.agency.id);

    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Tasks DELETE error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
