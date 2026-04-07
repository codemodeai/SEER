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
      const membership = await getAgencyMembership(user.id);
      if (!membership) {
        return NextResponse.json({ error: "Not part of an agency" }, { status: 403 });
      }

      let query = admin
        .from("fs_notes")
        .select("*, users!fs_notes_user_id_fkey(email)")
        .eq("agency_id", membership.agencyId)
        .order("created_at", { ascending: false });

      if (projectId) query = query.eq("project_id", projectId);

      const { data: notes, error } = await query;
      if (error) {
        console.error("Team notes fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch team notes" }, { status: 500 });
      }

      return NextResponse.json({ notes: notes ?? [], team: true });
    }

    let query = admin
      .from("fs_notes")
      .select("*")
      .eq("user_id", user.id)
      .is("agency_id", null)
      .order("created_at", { ascending: false });

    if (projectId) query = query.eq("project_id", projectId);

    const { data: notes, error } = await query;
    if (error) {
      console.error("Notes fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
    }

    return NextResponse.json({ notes: notes ?? [] });
  } catch (err) {
    console.error("Notes fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
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
    const { body: noteBody, project_id, team } = body as {
      body: string;
      project_id?: string;
      team?: boolean;
    };

    if (!noteBody?.trim()) {
      return NextResponse.json({ error: "Note body is required" }, { status: 400 });
    }

    let agencyId: string | null = null;
    if (team) {
      const membership = await getAgencyMembership(user.id);
      if (!membership) {
        return NextResponse.json({ error: "Not part of an agency" }, { status: 403 });
      }
      agencyId = membership.agencyId;
    }

    const admin = getSupabaseAdmin();
    const { data: note, error } = await admin
      .from("fs_notes")
      .insert({
        user_id: user.id,
        body: noteBody.trim(),
        project_id: project_id || null,
        agency_id: agencyId,
      })
      .select()
      .single();

    if (error) {
      console.error("Note create error:", error);
      return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
    }

    return NextResponse.json({ note });
  } catch (err) {
    console.error("Note create error:", err);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
