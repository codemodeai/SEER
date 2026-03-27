import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.suggestion_skin === "string" && ["default", "compact", "focused"].includes(body.suggestion_skin)) {
      updates.suggestion_skin = body.suggestion_skin;
    }
    if (typeof body.auto_suggest === "boolean") {
      updates.auto_suggest = body.auto_suggest;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    await admin.from("users").update(updates).eq("id", user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update preferences error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
