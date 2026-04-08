import { NextRequest, NextResponse } from "next/server";
import { createClient, getSupabaseAdmin } from "@/lib/supabase-server";
import { getAgencyMembership } from "@/lib/fs-team";
import { checkFsAccess } from "@/lib/fs-access";

// GET /api/founders-space/requests — list requests (members see own, admin sees all)
export async function GET(req: NextRequest) {
  try {
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

    const admin = getSupabaseAdmin();
    const projectId = req.nextUrl.searchParams.get("project_id");

    let query = admin
      .from("fs_requests")
      .select("*, users!fs_requests_user_id_fkey(email), resolver:users!fs_requests_resolved_by_fkey(email), fs_projects(name)")
      .eq("agency_id", membership.agencyId)
      .order("created_at", { ascending: false });

    // Members only see their own requests; owner/admin see all
    if (!membership.canWrite) {
      query = query.eq("user_id", user.id);
    }

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data: requests, error } = await query;

    if (error) {
      console.error("Requests fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
    }

    return NextResponse.json({ requests: requests ?? [], canWrite: membership.canWrite });
  } catch (err) {
    console.error("Requests fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
  }
}

// POST /api/founders-space/requests — create a request (members only)
export async function POST(req: NextRequest) {
  try {
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

    const body = await req.json();
    const { title, description, category, project_id } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const validCategories = ["credential", "document", "access", "other"];
    const cat = validCategories.includes(category) ? category : "other";

    const admin = getSupabaseAdmin();
    const { data: request, error } = await admin
      .from("fs_requests")
      .insert({
        agency_id: membership.agencyId,
        user_id: user.id,
        project_id: project_id || null,
        title: title.trim(),
        description: description?.trim() || null,
        category: cat,
        status: "pending",
      })
      .select("*, users!fs_requests_user_id_fkey(email), fs_projects(name)")
      .single();

    if (error) {
      console.error("Request create error:", error);
      return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
    }

    return NextResponse.json({ request });
  } catch (err) {
    console.error("Request create error:", err);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}
