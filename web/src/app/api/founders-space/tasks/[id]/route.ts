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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (!(await checkAccess(user.id))) {
      return NextResponse.json({ error: "Founder's Space access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.status !== undefined) {
      const validStatuses = ["open", "in_progress", "done", "blocked"];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updates.status = body.status;
    }
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.due_date !== undefined) updates.due_date = body.due_date || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const admin = getSupabaseAdmin();

    // Check if this is a team task
    const { data: task } = await admin
      .from("fs_tasks")
      .select("user_id, agency_id")
      .eq("id", id)
      .single();

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.agency_id) {
      // Team task — any agency member can update status
      const membership = await getAgencyMembership(user.id);
      if (!membership || membership.agencyId !== task.agency_id) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
    } else if (task.user_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { data: updated, error } = await admin
      .from("fs_tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Task update error:", error);
      return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }

    return NextResponse.json({ task: updated });
  } catch (err) {
    console.error("Task update error:", err);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (!(await checkAccess(user.id))) {
      return NextResponse.json({ error: "Founder's Space access required" }, { status: 403 });
    }

    const { id } = await params;
    const admin = getSupabaseAdmin();

    // Check if team task — only owner/admin can delete
    const { data: task } = await admin
      .from("fs_tasks")
      .select("user_id, agency_id")
      .eq("id", id)
      .single();

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.agency_id) {
      const membership = await getAgencyMembership(user.id);
      if (!membership || membership.agencyId !== task.agency_id || !membership.canWrite) {
        return NextResponse.json({ error: "Only agency owner/admin can delete team tasks" }, { status: 403 });
      }
    } else if (task.user_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { error } = await admin
      .from("fs_tasks")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Task delete error:", error);
      return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Task delete error:", err);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
