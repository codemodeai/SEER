import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getPlanByRazorpayPlanId } from "@/lib/plans";
import { sendPaymentConfirmationEmail, sendPaymentFailedEmail, sendCancellationEmail } from "@/lib/emails";

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

        const { error: planErr } = await supabase
          .from("users")
          .update({ plan, usage_this_month: 0 })
          .eq("id", userId);

        if (planErr) {
          console.error("Webhook: Failed to update user plan:", planErr);
        }

        const { error: subErr } = await supabase.from("subscriptions").upsert(
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

        if (subErr) {
          console.error("Webhook: Failed to upsert subscription:", subErr);
        }

        // Send payment confirmation email on activation
        if (event.event === "subscription.activated") {
          const email = sub.notes?.email;
          const billing = (sub.notes?.billing ?? "monthly") as "monthly" | "annual";
          if (email && plan) {
            const PRICES: Record<string, Record<string, number>> = {
              monthly: { starter: 19, pro: 49, agency: 59 },
              annual: { starter: 180, pro: 468, agency: 564 },
            };
            sendPaymentConfirmationEmail({
              to: email,
              plan,
              amountUsd: PRICES[billing]?.[plan] ?? 0,
              billing,
              provider: "razorpay",
              paymentId: sub.id,
            }).catch(() => {});
          }
        }
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

        if (record) {
          const { data: userData } = await supabase
            .from("users")
            .select("email, plan")
            .eq("id", record.user_id)
            .single();

          if (status === "cancelled") {
            await supabase
              .from("users")
              .update({ plan: "free" })
              .eq("id", record.user_id);
            if (userData?.email) {
              sendCancellationEmail({ to: userData.email, plan: userData.plan ?? "unknown" }).catch(() => {});
            }
          } else if (status === "past_due" && userData?.email) {
            sendPaymentFailedEmail({ to: userData.email, plan: userData.plan ?? "unknown" }).catch(() => {});
          }
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
