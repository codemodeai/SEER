import { NextRequest, NextResponse } from "next/server";
import { createClient, getSupabaseAdmin } from "@/lib/supabase-server";
import { getAgencyMembership } from "@/lib/fs-team";
import { checkFsAccess } from "@/lib/fs-access";

// PATCH /api/founders-space/requests/[id] — update request status (owner/admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (!(await checkFsAccess(user.id))) {
      return NextResponse.json({ error: "Founder's Space access required" }, { status: 403 });
    }

    const membership = await getAgencyMembership(user.id);
    if (!membership) {
      return NextResponse.json({ error: "Agency plan required" }, { status: 403 });
    }
    if (!membership.canWrite) {
      return NextResponse.json({ error: "Only owner/admin can update requests" }, { status: 403 });
    }

    const body = await req.json();
    const { status, resolve_note } = body;

    const validStatuses = ["pending", "in_progress", "done", "rejected"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Verify request belongs to this agency
    const { data: existing } = await admin
      .from("fs_requests")
      .select("agency_id")
      .eq("id", id)
      .single();

    if (!existing || existing.agency_id !== membership.agencyId) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const updateData: Record<string, any> = { status };

    if (status === "done" || status === "rejected") {
      updateData.resolved_by = user.id;
      updateData.resolved_at = new Date().toISOString();
    }

    if (resolve_note?.trim()) {
      updateData.resolve_note = resolve_note.trim();
    }

    const { data: updated, error } = await admin
      .from("fs_requests")
      .update(updateData)
      .eq("id", id)
      .select("*, users!fs_requests_user_id_fkey(email), resolver:users!fs_requests_resolved_by_fkey(email), fs_projects(name)")
      .single();

    if (error) {
      console.error("Request update error:", error);
      return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
    }

    return NextResponse.json({ request: updated });
  } catch (err) {
    console.error("Request update error:", err);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  }
}
