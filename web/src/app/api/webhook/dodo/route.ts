import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getPlanByDodoPriceId } from "@/lib/plans";
import { createAgencyForUser } from "@/lib/create-agency";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-dodo-signature") ?? "";

    // Verify webhook signature
    const webhookSecret = process.env.DODO_WEBHOOK_SECRET ?? "";
    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSig) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const supabase = getSupabaseAdmin();

    switch (event.event_type) {
      case "subscription.active": {
        const userId = event.data?.metadata?.user_id;
        const metadataType = event.data?.metadata?.type;

        // Handle addon payment — enable feature on the agency
        if (metadataType === "addon") {
          const feature = event.data?.metadata?.feature;
          const agencyId = event.data?.metadata?.agency_id;
          if (feature && agencyId) {
            const { data: agency } = await supabase
              .from("agencies")
              .select("id, enabled_features")
              .eq("id", agencyId)
              .single();

            if (agency) {
              const features = agency.enabled_features ?? {};
              features[feature] = true;
              const addonPrice = (features.project_management ? 5 : 0) + (features.webhooks ? 3 : 0);
              await supabase
                .from("agencies")
                .update({ enabled_features: features, addon_price: addonPrice })
                .eq("id", agency.id);
            }
          }
          break;
        }

        const plan = event.data?.metadata?.seer_plan ?? getPlanByDodoPriceId(event.data?.product_id ?? "");
        if (!userId || !plan) break;

        // Update user plan
        await supabase
          .from("users")
          .update({ plan, usage_this_month: 0 })
          .eq("id", userId);

        // Store subscription record
        await supabase.from("subscriptions").upsert(
          {
            user_id: userId,
            provider: "dodo",
            provider_sub_id: event.data.subscription_id,
            plan,
            status: "active",
            current_period_end: event.data.current_period_end,
          },
          { onConflict: "user_id,provider" }
        );

        // Auto-create agency for agency plan subscribers
        if (plan === "agency") {
          const { data: userData } = await supabase
            .from("users")
            .select("email")
            .eq("id", userId)
            .single();
          const maxUsers = event.data?.metadata?.max_users ? parseInt(event.data.metadata.max_users, 10) : undefined;
          await createAgencyForUser(supabase, userId, userData?.email ?? "", maxUsers);
        }
        break;
      }

      case "subscription.cancelled":
      case "subscription.past_due": {
        const subId = event.data?.subscription_id;
        if (!subId) break;

        const status = event.event_type === "subscription.cancelled" ? "cancelled" : "past_due";

        // Update subscription status
        const { data: sub } = await supabase
          .from("subscriptions")
          .update({ status })
          .eq("provider_sub_id", subId)
          .eq("provider", "dodo")
          .select("user_id")
          .single();

        // If cancelled, downgrade to free
        if (status === "cancelled" && sub) {
          await supabase
            .from("users")
            .update({ plan: "free" })
            .eq("id", sub.user_id);
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Dodo webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
