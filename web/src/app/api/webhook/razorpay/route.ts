import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getPlanByRazorpayPlanId } from "@/lib/plans";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") ?? "";

    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSig) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const supabase = getSupabaseAdmin();

    switch (event.event) {
      case "subscription.activated":
      case "subscription.charged": {
        const sub = event.payload?.subscription?.entity;
        if (!sub) break;

        const userId = sub.notes?.user_id;
        const plan = sub.notes?.seer_plan ?? getPlanByRazorpayPlanId(sub.plan_id);
        if (!userId || !plan) break;

        await supabase
          .from("users")
          .update({ plan, usage_this_month: 0 })
          .eq("id", userId);

        await supabase.from("subscriptions").upsert(
          {
            user_id: userId,
            provider: "razorpay",
            provider_sub_id: sub.id,
            plan,
            status: "active",
            current_period_end: sub.current_end
              ? new Date(sub.current_end * 1000).toISOString()
              : null,
          },
          { onConflict: "user_id,provider" }
        );
        break;
      }

      case "subscription.cancelled":
      case "subscription.paused": {
        const sub = event.payload?.subscription?.entity;
        if (!sub) break;

        const status = event.event === "subscription.cancelled" ? "cancelled" : "past_due";

        const { data: record } = await supabase
          .from("subscriptions")
          .update({ status })
          .eq("provider_sub_id", sub.id)
          .eq("provider", "razorpay")
          .select("user_id")
          .single();

        if (status === "cancelled" && record) {
          await supabase
            .from("users")
            .update({ plan: "free" })
            .eq("id", record.user_id);
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Razorpay webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
