import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";

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
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Fetch agency by slug
    const { data: agency, error: agencyErr } = await admin
      .from("agencies")
      .select("*")
      .eq("slug", slug)
      .single();

    if (agencyErr || !agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    // Check if user is owner or member
    const isOwner = agency.owner_id === user.id;

    let membership = null;
    if (!isOwner) {
      const { data: member } = await admin
        .from("agency_users")
        .select("role, assigned_plan, joined_at")
        .eq("agency_id", agency.id)
        .eq("user_id", user.id)
        .single();

      if (!member) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      // Only admins can access the agency portal — regular members use their own dashboard
      if (member.role !== "admin") {
        return NextResponse.json({ error: "Access denied. Only admins can access the agency portal." }, { status: 403 });
      }

      membership = member;
    }

    // Get member count
    const { count: memberCount } = await admin
      .from("agency_users")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agency.id);

    // Parse enabled_features (JSONB column from migration 010)
    const enabledFeatures = agency.enabled_features ?? { announcements: true, project_management: false };

    return NextResponse.json({
      agency: {
        id: agency.id,
        name: agency.name,
        slug: agency.slug,
        status: agency.status,
        maxUsers: agency.max_users,
        logoUrl: agency.logo_url,
        memberCount: memberCount ?? 0,
        createdAt: agency.created_at,
        enabledFeatures,
      },
      role: isOwner ? "owner" : membership?.role ?? "member",
      userId: user.id,
    });
  } catch (err) {
    console.error("Agency fetch error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
