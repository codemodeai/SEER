import { NextRequest, NextResponse } from "next/server";
import { getUsdToInr } from "@/lib/exchange-rate";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const RAZORPAY_API_URL = "https://api.razorpay.com/v1";

const ADDON_PRICES: Record<string, number> = {
  project_management: 5,
};

// POST /api/agency/addon-checkout — create payment for an agency addon feature
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, email, feature, label, priceUsd, agencySlug, preferredProvider } = body;

    if (!userId || !email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!feature || !ADDON_PRICES[feature]) {
      return NextResponse.json({ error: "Invalid addon feature" }, { status: 400 });
    }
    if (priceUsd !== ADDON_PRICES[feature]) {
      return NextResponse.json({ error: "Price mismatch" }, { status: 400 });
    }
    if (!agencySlug) {
      return NextResponse.json({ error: "Agency slug required" }, { status: 400 });
    }

    // Verify user owns this agency
    const admin = getSupabaseAdmin();
    const { data: agency } = await admin
      .from("agencies")
      .select("id, owner_id")
      .eq("slug", agencySlug)
      .single();

    if (!agency || agency.owner_id !== userId) {
      return NextResponse.json({ error: "Only the agency owner can purchase addons" }, { status: 403 });
    }

    const hasRazorpay = !!process.env.RAZORPAY_KEY_ID;
    const hasDodo = !!process.env.DODO_API_KEY;

    if (!hasRazorpay && !hasDodo) {
      // No payment gateway — just enable the feature directly (dev mode)
      const { data: currentAgency } = await admin
        .from("agencies")
        .select("enabled_features")
        .eq("id", agency.id)
        .single();

      const features = currentAgency?.enabled_features ?? {};
      features[feature] = true;

      await admin
        .from("agencies")
        .update({ enabled_features: features, addon_price: (features.project_management ? 5 : 0) })
        .eq("id", agency.id);

      return NextResponse.json({
        provider: "free",
        message: `${label} enabled (dev mode — no payment gateway configured).`,
        enabled: true,
      });
    }

    const useDodo = preferredProvider === "dodo" && hasDodo;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    if (useDodo) {
      const DODO_API_URL = process.env.DODO_API_KEY?.startsWith("sk_live")
        ? "https://live.dodopayments.com"
        : "https://test.dodopayments.com";
      const addonProductId = process.env.DODO_ADDON_PM_PRICE_ID ?? "";

      if (!addonProductId) {
        return NextResponse.json({ error: "Addon product not configured for Dodo" }, { status: 500 });
      }

      const dodoRes = await fetch(`${DODO_API_URL}/checkouts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.DODO_API_KEY ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_cart: [{ product_id: addonProductId, quantity: 1 }],
          customer: { email, name: email.split("@")[0] },
          return_url: `${appUrl}/agency/${agencySlug}/settings?addon_enabled=${feature}`,
          metadata: {
            user_id: userId,
            type: "addon",
            feature,
            agency_slug: agencySlug,
            agency_id: agency.id,
          },
        }),
      });

      if (!dodoRes.ok) {
        const errText = await dodoRes.text();
        console.error("Dodo addon checkout error:", dodoRes.status, errText);
        return NextResponse.json({ error: "Payment error" }, { status: 502 });
      }

      const dodoData = await dodoRes.json();
      return NextResponse.json({
        provider: "dodo",
        checkoutUrl: dodoData.checkout_url,
      });
    }

    // Razorpay
    const razorpayKey = process.env.RAZORPAY_KEY_ID?.trim();
    const razorpaySecret = (process.env.RAZORPAY_KEY_SECRET ?? "").trim();

    if (!razorpayKey || !razorpaySecret) {
      return NextResponse.json({ error: "Payment not configured" }, { status: 500 });
    }

    const auth = Buffer.from(`${razorpayKey}:${razorpaySecret}`).toString("base64");
    const rate = await getUsdToInr();
    const subtotalInr = Math.round(priceUsd * rate);
    const gstAmount = Math.round(subtotalInr * 0.18);
    const totalPaise = (subtotalInr + gstAmount) * 100;

    // Create a Razorpay plan for the addon
    const planRes = await fetch(`${RAZORPAY_API_URL}/plans`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        period: "monthly",
        interval: 1,
        item: {
          name: `SEER ${label} Add-on`,
          amount: totalPaise,
          currency: "INR",
          description: `${label} add-on for agency ${agencySlug}`,
        },
      }),
    });

    if (!planRes.ok) {
      console.error("Razorpay addon plan error:", await planRes.text());
      return NextResponse.json({ error: "Failed to create payment plan" }, { status: 502 });
    }
    const planData = await planRes.json();

    // Create subscription
    const subRes = await fetch(`${RAZORPAY_API_URL}/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: planData.id,
        total_count: 120,
        notes: {
          user_id: userId,
          type: "addon",
          feature,
          agency_slug: agencySlug,
          agency_id: agency.id,
        },
      }),
    });

    if (!subRes.ok) {
      console.error("Razorpay addon sub error:", await subRes.text());
      return NextResponse.json({ error: "Failed to create subscription" }, { status: 502 });
    }
    const subData = await subRes.json();

    return NextResponse.json({
      provider: "razorpay",
      subscriptionId: subData.id,
      razorpayKeyId: razorpayKey,
      planName: label,
      priceUsd,
    });
  } catch (err) {
    console.error("Addon checkout error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
