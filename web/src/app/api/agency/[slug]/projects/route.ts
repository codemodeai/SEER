import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { checkAgencyFeature } from "@/lib/agency-features";
import { fireWebhooks } from "@/lib/webhook-deliver";

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

// GET /api/agency/[slug]/projects — list all projects
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const user = await authenticate();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const access = await getAgencyAccess(slug, user.id);
    if (!access) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    const { enabled } = await checkAgencyFeature(access.agency.id, "project_management");
    if (!enabled) return NextResponse.json({ error: "Project Management feature is not enabled" }, { status: 403 });

    const admin = getSupabaseAdmin();

    const statusFilter = req.nextUrl.searchParams.get("status");

    let query = admin
      .from("agency_pm_projects")
      .select("id, name, description, status, priority, created_by, start_date, due_date, created_at, updated_at")
      .eq("agency_id", access.agency.id)
      .order("updated_at", { ascending: false });

    if (statusFilter && ["active", "archived", "completed"].includes(statusFilter)) {
      query = query.eq("status", statusFilter);
    }

    const { data: projects } = await query;

    // Get task counts per project
    const projectIds = (projects ?? []).map((p: any) => p.id);
    let taskStats: Record<string, { total: number; done: number }> = {};

    if (projectIds.length > 0) {
      const { data: tasks } = await admin
        .from("agency_pm_tasks")
        .select("project_id, status")
        .in("project_id", projectIds);

      for (const t of tasks ?? []) {
        if (!taskStats[t.project_id]) taskStats[t.project_id] = { total: 0, done: 0 };
        taskStats[t.project_id].total++;
        if (t.status === "done") taskStats[t.project_id].done++;
      }
    }

    // Get creator emails
    const creatorIds = [...new Set((projects ?? []).map((p: any) => p.created_by))];
    const { data: creators } = creatorIds.length > 0
      ? await admin.from("users").select("id, email").in("id", creatorIds)
      : { data: [] };
    const creatorMap: Record<string, string> = {};
    for (const c of creators ?? []) creatorMap[c.id] = c.email;

    const enriched = (projects ?? []).map((p: any) => ({
      ...p,
      creatorEmail: creatorMap[p.created_by] ?? "Unknown",
      taskCount: taskStats[p.id]?.total ?? 0,
      tasksDone: taskStats[p.id]?.done ?? 0,
    }));

    return NextResponse.json({ projects: enriched });
  } catch (err) {
    console.error("Projects GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/agency/[slug]/projects — create a project
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const user = await authenticate();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const access = await getAgencyAccess(slug, user.id);
    if (!access || access.role === "member") {
      return NextResponse.json({ error: "Only owner/admin can create projects" }, { status: 403 });
    }

    const { enabled } = await checkAgencyFeature(access.agency.id, "project_management");
    if (!enabled) return NextResponse.json({ error: "Project Management feature is not enabled" }, { status: 403 });

    const body = await req.json();
    const name = (body.name ?? "").trim();
    const description = (body.description ?? "").trim();
    const priority = body.priority ?? "medium";
    const startDate = body.startDate || null;
    const dueDate = body.dueDate || null;

    if (!name || name.length > 200) {
      return NextResponse.json({ error: "Name is required (max 200 characters)" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: project, error: insertErr } = await admin
      .from("agency_pm_projects")
      .insert({
        agency_id: access.agency.id,
        name,
        description,
        priority,
        start_date: startDate,
        due_date: dueDate,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Fire webhook
    fireWebhooks(access.agency.id, "project.created", {
      project_id: project.id,
      name: project.name,
      created_by: user.id,
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    console.error("Projects POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH /api/agency/[slug]/projects — update a project
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const user = await authenticate();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const access = await getAgencyAccess(slug, user.id);
    if (!access || access.role === "member") {
      return NextResponse.json({ error: "Only owner/admin can update projects" }, { status: 403 });
    }

    const body = await req.json();
    const { project_id } = body;
    if (!project_id) return NextResponse.json({ error: "project_id required" }, { status: 400 });

    const updates: Record<string, any> = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name || name.length > 200) return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      updates.name = name;
    }
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined && ["active", "archived", "completed"].includes(body.status)) updates.status = body.status;
    if (body.priority !== undefined && ["low", "medium", "high", "urgent"].includes(body.priority)) updates.priority = body.priority;
    if (body.startDate !== undefined) updates.start_date = body.startDate || null;
    if (body.dueDate !== undefined) updates.due_date = body.dueDate || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error: updateErr } = await admin
      .from("agency_pm_projects")
      .update(updates)
      .eq("id", project_id)
      .eq("agency_id", access.agency.id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Projects PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/agency/[slug]/projects — delete a project
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const user = await authenticate();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const access = await getAgencyAccess(slug, user.id);
    if (!access || access.role === "member") {
      return NextResponse.json({ error: "Only owner/admin can delete projects" }, { status: 403 });
    }

    const projectId = req.nextUrl.searchParams.get("project_id");
    if (!projectId) return NextResponse.json({ error: "project_id required" }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { error: deleteErr } = await admin
      .from("agency_pm_projects")
      .delete()
      .eq("id", projectId)
      .eq("agency_id", access.agency.id);

    if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Projects DELETE error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
