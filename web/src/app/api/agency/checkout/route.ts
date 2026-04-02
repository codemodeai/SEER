import { NextRequest, NextResponse } from "next/server";
import { getUsdToInr } from "@/lib/exchange-rate";

const RAZORPAY_API_URL = "https://api.razorpay.com/v1";

function isConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID || process.env.DODO_API_KEY);
}

// POST /api/agency/checkout — create agency subscription with dynamic pricing
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      email,
      agencyName,
      memberTier,
      maxUsers,
      basePrice,
      addonPrice,
      totalPrice,
      enabledFeatures,
      preferredProvider,
    } = body as {
      userId: string;
      email: string;
      agencyName: string;
      memberTier: string;
      maxUsers: number;
      basePrice: number;
      addonPrice: number;
      totalPrice: number;
      enabledFeatures: Record<string, boolean>;
      preferredProvider?: "razorpay" | "dodo";
    };

    // Validate
    if (!userId || !email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!agencyName || agencyName.trim().length < 2) {
      return NextResponse.json({ error: "Agency name is required" }, { status: 400 });
    }
    if (!memberTier || !maxUsers || !totalPrice) {
      return NextResponse.json({ error: "Invalid plan configuration" }, { status: 400 });
    }

    // Verify price matches tier (server-side validation)
    const TIER_PRICES: Record<string, number> = {
      "1-5": 59, "6-10": 99, "11-15": 149,
      "16-20": 199, "21-25": 249, "26-30": 299,
    };
    const expectedBase = TIER_PRICES[memberTier];
    if (!expectedBase || expectedBase !== basePrice) {
      return NextResponse.json({ error: "Invalid pricing" }, { status: 400 });
    }

    // Verify addon pricing
    let expectedAddon = 0;
    if (enabledFeatures?.project_management) expectedAddon += 5;
    if (expectedAddon !== addonPrice) {
      return NextResponse.json({ error: "Invalid addon pricing" }, { status: 400 });
    }

    const expectedTotal = expectedBase + expectedAddon;
    if (expectedTotal !== totalPrice) {
      return NextResponse.json({ error: "Price mismatch" }, { status: 400 });
    }

    if (!isConfigured()) {
      return NextResponse.json({
        provider: "demo",
        message: `Agency "${agencyName}" — ${memberTier} members — $${totalPrice}/mo. Configure payment keys to proceed.`,
      });
    }

    const hasRazorpay = !!process.env.RAZORPAY_KEY_ID;
    const hasDodo = !!process.env.DODO_API_KEY;

    // Determine provider based on user preference
    const useDodo = preferredProvider === "dodo" && hasDodo;

    if (useDodo) {
      // --- Dodo Payments (USD, hosted checkout) ---
      const DODO_API_URL = process.env.DODO_API_KEY?.startsWith("sk_live")
        ? "https://live.dodopayments.com"
        : "https://test.dodopayments.com";
      const dodoAgencyProductId = process.env.DODO_AGENCY_PRICE_ID ?? "";

      if (!dodoAgencyProductId) {
        return NextResponse.json({ error: "Agency product not configured for Dodo" }, { status: 500 });
      }

      const dodoRes = await fetch(`${DODO_API_URL}/checkouts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.DODO_API_KEY ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_cart: [{ product_id: dodoAgencyProductId, quantity: 1 }],
          customer: { email, name: email.split("@")[0] },
          return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/payment/success?plan=agency&price=${totalPrice}`,
          metadata: {
            user_id: userId,
            seer_plan: "agency",
            agency_name: agencyName,
            member_tier: memberTier,
            max_users: String(maxUsers),
            base_price: String(basePrice),
            addon_price: String(addonPrice),
            total_price: String(totalPrice),
            enabled_features: JSON.stringify(enabledFeatures),
          },
        }),
      });

      if (!dodoRes.ok) {
        const errText = await dodoRes.text();
        console.error("Dodo agency checkout error:", dodoRes.status, errText);
        let detail = "";
        try { detail = JSON.parse(errText)?.message || errText; } catch { detail = errText; }
        return NextResponse.json({ error: `Payment error: ${detail}` }, { status: 502 });
      }

      const dodoData = await dodoRes.json();
      console.log("Agency Dodo checkout created:", dodoData);

      return NextResponse.json({
        provider: "dodo",
        checkoutUrl: dodoData.checkout_url,
        sessionId: dodoData.session_id,
        priceUsd: totalPrice,
      });
    }

    // --- Razorpay (INR, modal checkout) ---
    const razorpayKey = process.env.RAZORPAY_KEY_ID?.trim();
    const razorpaySecret = (process.env.RAZORPAY_KEY_SECRET ?? "").trim();

    if (!razorpayKey || !razorpaySecret) {
      return NextResponse.json({ error: "Payment not configured" }, { status: 500 });
    }

    const auth = Buffer.from(`${razorpayKey}:${razorpaySecret}`).toString("base64");
    const rate = await getUsdToInr();
    const subtotalInr = Math.round(totalPrice * rate);
    const gstAmount = Math.round(subtotalInr * 0.18);
    const totalInrWithGst = subtotalInr + gstAmount;
    const amountPaise = totalInrWithGst * 100;

    // Step 1: Create a Razorpay plan for this specific configuration
    const planRes = await fetch(`${RAZORPAY_API_URL}/plans`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        period: "monthly",
        interval: 1,
        item: {
          name: `SEER Agency — ${memberTier} members`,
          amount: amountPaise,
          currency: "INR",
          description: `Agency plan: ${agencyName} (${memberTier} members, $${totalPrice}/mo)`,
        },
        notes: {
          seer_plan: "agency",
          member_tier: memberTier,
          max_users: String(maxUsers),
          addon_price: String(addonPrice),
          agency_name: agencyName,
        },
      }),
    });

    if (!planRes.ok) {
      const errText = await planRes.text();
      console.error("Razorpay plan creation error:", errText);
      return NextResponse.json(
        { error: "Failed to create payment plan. Please try again." },
        { status: 502 }
      );
    }

    const plan = await planRes.json();

    // Step 2: Create subscription from that plan
    const subRes = await fetch(`${RAZORPAY_API_URL}/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan_id: plan.id,
        total_count: 12,
        quantity: 1,
        notes: {
          user_id: userId,
          email,
          seer_plan: "agency",
          agency_name: agencyName,
          member_tier: memberTier,
          max_users: String(maxUsers),
          base_price: String(basePrice),
          addon_price: String(addonPrice),
          total_price: String(totalPrice),
          enabled_features: JSON.stringify(enabledFeatures),
        },
      }),
    });

    if (!subRes.ok) {
      const errText = await subRes.text();
      console.error("Razorpay subscription error:", errText);
      let detail = "";
      try {
        detail = JSON.parse(errText)?.error?.description || errText;
      } catch {
        detail = errText;
      }
      return NextResponse.json(
        { error: `Payment error: ${detail}` },
        { status: 502 }
      );
    }

    const sub = await subRes.json();

    console.log("Agency checkout created:", {
      subscriptionId: sub.id,
      planId: plan.id,
      agency: agencyName,
      tier: memberTier,
      total: totalPrice,
    });

    return NextResponse.json({
      provider: "razorpay",
      subscriptionId: sub.id,
      razorpayKeyId: razorpayKey,
      amount: amountPaise,
      currency: "INR",
      planName: `Agency — ${memberTier} members`,
      priceUsd: totalPrice,
      subtotalInr,
      gstAmount,
      totalInr: totalInrWithGst,
    });
  } catch (err) {
    console.error("Agency checkout error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
