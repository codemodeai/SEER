import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { checkAgencyFeature } from "@/lib/agency-features";
import { fireWebhooks } from "@/lib/webhook-deliver";

async function getAgencyAndRole(slug: string, userId: string) {
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

// GET /api/agency/[slug]/announcements — list announcements
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
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
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const result = await getAgencyAndRole(slug, user.id);
    if (!result) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Feature gate
    const { enabled } = await checkAgencyFeature(result.agency.id, "announcements");
    if (!enabled) {
      return NextResponse.json({ error: "Announcements feature is not enabled for this agency" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const { data: announcements } = await admin
      .from("agency_announcements")
      .select("id, title, body, pinned, author_id, created_at, updated_at")
      .eq("agency_id", result.agency.id)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });

    // Attach author emails
    const authorIds = [...new Set((announcements ?? []).map((a: any) => a.author_id))];
    const { data: authors } = authorIds.length > 0
      ? await admin.from("users").select("id, email").in("id", authorIds)
      : { data: [] };

    const authorMap: Record<string, string> = {};
    for (const a of authors ?? []) {
      authorMap[a.id] = a.email;
    }

    const enriched = (announcements ?? []).map((a: any) => ({
      ...a,
      authorEmail: authorMap[a.author_id] ?? "Unknown",
    }));

    return NextResponse.json({ announcements: enriched });
  } catch (err) {
    console.error("Announcements GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/agency/[slug]/announcements — create announcement
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
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
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const result = await getAgencyAndRole(slug, user.id);
    if (!result || result.role === "member") {
      return NextResponse.json({ error: "Only owner/admin can create announcements" }, { status: 403 });
    }

    const { enabled: featureEnabled } = await checkAgencyFeature(result.agency.id, "announcements");
    if (!featureEnabled) {
      return NextResponse.json({ error: "Announcements feature is not enabled" }, { status: 403 });
    }

    const body = await req.json();
    const title = (body.title ?? "").trim();
    const content = (body.body ?? "").trim();
    const pinned = body.pinned === true;

    if (!title || title.length > 200) {
      return NextResponse.json({ error: "Title is required (max 200 characters)" }, { status: 400 });
    }
    if (content.length > 5000) {
      return NextResponse.json({ error: "Body must be under 5000 characters" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: announcement, error: insertErr } = await admin
      .from("agency_announcements")
      .insert({
        agency_id: result.agency.id,
        author_id: user.id,
        title,
        body: content,
        pinned,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Fire webhook
    fireWebhooks(result.agency.id, "announcement.created", {
      announcement_id: announcement.id,
      title,
      author_id: user.id,
    });

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (err) {
    console.error("Announcements POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH /api/agency/[slug]/announcements — update announcement
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
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
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const result = await getAgencyAndRole(slug, user.id);
    if (!result || result.role === "member") {
      return NextResponse.json({ error: "Only owner/admin can edit announcements" }, { status: 403 });
    }

    const { enabled: featureEnabled } = await checkAgencyFeature(result.agency.id, "announcements");
    if (!featureEnabled) {
      return NextResponse.json({ error: "Announcements feature is not enabled" }, { status: 403 });
    }

    const body = await req.json();
    const { announcement_id } = body;
    if (!announcement_id) {
      return NextResponse.json({ error: "announcement_id required" }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title || title.length > 200) {
        return NextResponse.json({ error: "Title is required (max 200 characters)" }, { status: 400 });
      }
      updates.title = title;
    }
    if (body.body !== undefined) {
      if (body.body.length > 5000) {
        return NextResponse.json({ error: "Body must be under 5000 characters" }, { status: 400 });
      }
      updates.body = body.body;
    }
    if (body.pinned !== undefined) {
      updates.pinned = body.pinned === true;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error: updateErr } = await admin
      .from("agency_announcements")
      .update(updates)
      .eq("id", announcement_id)
      .eq("agency_id", result.agency.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Announcements PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/agency/[slug]/announcements — delete announcement
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
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
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const result = await getAgencyAndRole(slug, user.id);
    if (!result || result.role === "member") {
      return NextResponse.json({ error: "Only owner/admin can delete announcements" }, { status: 403 });
    }

    const { enabled: featureEnabled } = await checkAgencyFeature(result.agency.id, "announcements");
    if (!featureEnabled) {
      return NextResponse.json({ error: "Announcements feature is not enabled" }, { status: 403 });
    }

    const announcementId = req.nextUrl.searchParams.get("announcement_id");
    if (!announcementId) {
      return NextResponse.json({ error: "announcement_id required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error: deleteErr } = await admin
      .from("agency_announcements")
      .delete()
      .eq("id", announcementId)
      .eq("agency_id", result.agency.id);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Announcements DELETE error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
