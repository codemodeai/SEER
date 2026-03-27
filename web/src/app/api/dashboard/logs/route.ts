import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";

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

    // Fetch recent logs, stats, and feature breakdown in parallel
    const [recentRes, statsRes] = await Promise.all([
      admin
        .from("seer_logs")
        .select("id, timestamp, raw_input, surface, raw_tokens, optimized_tokens, pct_saved, tokens_saved, tool_used")
        .eq("user_id", user.id)
        .order("timestamp", { ascending: false })
        .limit(10),
      admin
        .from("seer_logs")
        .select("tokens_saved, pct_saved, tool_used, raw_tokens, optimized_tokens, raw_input")
        .eq("user_id", user.id),
    ]);

    // Daily savings
    const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30");
    const { data: dailySavings } = await admin.rpc("daily_savings", {
      uid: user.id,
      days,
    });

    return NextResponse.json({
      recent: recentRes.data ?? [],
      allLogs: statsRes.data ?? [],
      dailySavings: dailySavings ?? [],
    });
  } catch (err) {
    console.error("Dashboard logs error:", err);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
