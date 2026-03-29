import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { createAgencyForUser } from "@/lib/create-agency";

// POST /api/agency/create — manually create an agency (for agency-plan users who don't have one yet)
export async function POST(req: NextRequest) {
  try {
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

    // Verify user is on agency plan
    const { data: userData } = await admin
      .from("users")
      .select("plan, email")
      .eq("id", user.id)
      .single();

    if (!userData || userData.plan !== "agency") {
      return NextResponse.json(
        { error: "Agency creation requires an Agency plan subscription" },
        { status: 403 }
      );
    }

    const result = await createAgencyForUser(
      admin,
      user.id,
      userData.email || user.email || ""
    );

    if (!result) {
      return NextResponse.json({ error: "Failed to create agency" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      agency: { id: result.id, slug: result.slug },
    });
  } catch (err) {
    console.error("Agency create error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
