import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";

// PATCH /api/agency/[slug]/settings — update agency settings (owner only)
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

    // Verify agency exists and user is owner
    const { data: agency } = await admin
      .from("agencies")
      .select("id, owner_id")
      .eq("slug", slug)
      .single();

    if (!agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    if (agency.owner_id !== user.id) {
      return NextResponse.json({ error: "Only the agency owner can update settings" }, { status: 403 });
    }

    const body = await req.json();
    const updates: Record<string, any> = {};

    // Validate and apply name
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length < 2 || name.length > 100) {
        return NextResponse.json({ error: "Name must be 2-100 characters" }, { status: 400 });
      }
      updates.name = name;
    }

    // Validate and apply max_users
    if (body.max_users !== undefined) {
      const maxUsers = parseInt(body.max_users, 10);
      if (isNaN(maxUsers) || maxUsers < 1 || maxUsers > 100) {
        return NextResponse.json({ error: "Max users must be 1-100" }, { status: 400 });
      }
      updates.max_users = maxUsers;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { error } = await admin
      .from("agencies")
      .update(updates)
      .eq("id", agency.id);

    if (error) {
      console.error("Agency settings update error:", error);
      return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Agency settings PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
