import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";

// GET /api/dashboard/announcements — fetch announcements for the current user's agency
export async function GET(req: NextRequest) {
  try {
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

    const admin = getSupabaseAdmin();

    // Find user's agency (as member or owner)
    let agencyId: string | null = null;

    // Check membership first (most common for dashboard users)
    const { data: membership } = await admin
      .from("agency_users")
      .select("agency_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (membership) {
      agencyId = membership.agency_id;
    } else {
      // Check if owner
      const { data: ownedAgency } = await admin
        .from("agencies")
        .select("id")
        .eq("owner_id", user.id)
        .eq("status", "active")
        .limit(1)
        .single();

      if (ownedAgency) {
        agencyId = ownedAgency.id;
      }
    }

    if (!agencyId) {
      return NextResponse.json({ announcements: [] });
    }

    // Fetch announcements (pinned first, then newest)
    const { data: announcements } = await admin
      .from("agency_announcements")
      .select("id, title, body, pinned, author_id, created_at")
      .eq("agency_id", agencyId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);

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
    console.error("Dashboard announcements error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
