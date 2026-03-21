import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const { reason, feedback } = await req.json();

    if (!reason || !feedback?.trim()) {
      return NextResponse.json(
        { error: "Feedback is required to cancel your plan." },
        { status: 400 }
      );
    }

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

    // Get current plan before canceling
    const { data: userData } = await admin
      .from("users")
      .select("plan, email")
      .eq("id", user.id)
      .single();

    if (!userData || userData.plan === "free") {
      return NextResponse.json(
        { error: "You are already on the free plan." },
        { status: 400 }
      );
    }

    const previousPlan = userData.plan;

    // Store cancellation feedback
    await admin.from("cancellation_feedback").insert({
      user_id: user.id,
      email: userData.email || user.email,
      previous_plan: previousPlan,
      reason,
      feedback: feedback.trim(),
    });

    // Downgrade to free
    await admin
      .from("users")
      .update({ plan: "free" })
      .eq("id", user.id);

    return NextResponse.json({
      success: true,
      message: "Plan cancelled. You are now on the Free plan.",
      previousPlan,
    });
  } catch (err) {
    console.error("Cancel plan error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
