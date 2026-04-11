import { NextRequest, NextResponse } from "next/server";
import { PLANS, type BillingCycle, getEffectivePrice, getTotalCharge } from "@/lib/plans";
import { getUsdToInr } from "@/lib/exchange-rate";

// Use test.dodopayments.com for test keys, live.dodopayments.com for production
const DODO_API_URL = process.env.DODO_API_KEY?.startsWith("sk_live")
  ? "https://live.dodopayments.com"
  : "https://test.dodopayments.com";
const RAZORPAY_API_URL = "https://api.razorpay.com/v1";

function isConfigured(): boolean {
  return !!(process.env.DODO_API_KEY || process.env.RAZORPAY_KEY_ID);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan, userId, email, preferredProvider, billing = "monthly" } = body as {
      plan: string;
      userId: string;
      email: string;
      preferredProvider?: "razorpay" | "dodo";
      billing?: BillingCycle;
    };

    const planConfig = PLANS[plan];
    if (!planConfig) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    if (plan === "free") {
      return NextResponse.json({ error: "Free plan needs no payment" }, { status: 400 });
    }

    const isAnnual = billing === "annual";
    const effectiveMonthlyUsd = getEffectivePrice(planConfig, billing);
    const totalChargeUsd = getTotalCharge(planConfig, billing);

    // --- DEMO MODE: when payment keys aren't configured ---
    if (!isConfigured()) {
      return NextResponse.json({
        provider: "demo",
        plan: planConfig.name,
        priceUsd: effectiveMonthlyUsd,
        billing,
        message: `Payment gateway not configured yet. In production, this will redirect to checkout for the ${planConfig.name} plan at $${effectiveMonthlyUsd}/mo${isAnnual ? ` (billed $${totalChargeUsd}/yr)` : ""}.`,
      });
    }

    // Detect country from request headers (Vercel provides this)
    const country =
      req.headers.get("x-vercel-ip-country") ??
      req.headers.get("cf-ipcountry") ??
      "";

    const hasRazorpay = !!process.env.RAZORPAY_KEY_ID;
    const hasDodo = !!process.env.DODO_API_KEY;
    const isDev = process.env.NODE_ENV === "development";

    // If user explicitly chose a provider, respect it (when both are available)
    // Otherwise: India/unknown → Razorpay, non-India → Dodo
    const isIndia = country === "IN" || country === "";
    let useRazorpay: boolean;
    if (preferredProvider === "dodo" && hasDodo) {
      useRazorpay = false;
    } else if (preferredProvider === "razorpay" && hasRazorpay) {
      useRazorpay = true;
    } else {
      useRazorpay = hasRazorpay && (isIndia || !hasDodo || isDev);
    }

    const razorpayPlanId = isAnnual ? planConfig.razorpayAnnualPlanId : planConfig.razorpayPlanId;
    const dodoPriceId = isAnnual ? planConfig.dodoAnnualPriceId : planConfig.dodoPriceId;

    console.log("Checkout routing:", {
      country,
      hasRazorpay,
      hasDodo,
      isDev,
      isIndia,
      useRazorpay,
      plan,
      billing,
      planId: razorpayPlanId,
    });

    if (useRazorpay) {
      // --- Razorpay subscription ---
      const razorpayKey = process.env.RAZORPAY_KEY_ID?.trim();
      const razorpaySecret = (process.env.RAZORPAY_KEY_SECRET ?? "").trim();

      if (!razorpayKey || !razorpaySecret) {
        console.error("Razorpay keys missing:", { keyPresent: !!razorpayKey, secretPresent: !!razorpaySecret });
        return NextResponse.json(
          { error: "Payment gateway not configured. Please contact support." },
          { status: 500 }
        );
      }

      if (!razorpayPlanId) {
        console.error("Razorpay plan ID missing for plan:", plan, "billing:", billing);
        return NextResponse.json(
          { error: `Plan configuration error for ${planConfig.name}. Please contact support.` },
          { status: 500 }
        );
      }

      const auth = Buffer.from(`${razorpayKey}:${razorpaySecret}`).toString(
        "base64"
      );

      const subRes = await fetch(`${RAZORPAY_API_URL}/subscriptions`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan_id: razorpayPlanId,
          total_count: isAnnual ? 1 : 12,
          quantity: 1,
          notes: { user_id: userId, email, seer_plan: plan, billing },
        }),
      });

      if (!subRes.ok) {
        const errText = await subRes.text();
        console.error("Razorpay subscription error:", {
          status: subRes.status,
          body: errText,
          planId: razorpayPlanId,
          keyPrefix: razorpayKey?.substring(0, 12),
        });
        let detail = "";
        try {
          const errJson = JSON.parse(errText);
          detail = errJson?.error?.description || errText;
        } catch {
          detail = errText;
        }
        return NextResponse.json(
          { error: `Payment provider error: ${detail}` },
          { status: 502 }
        );
      }

      const sub = await subRes.json();

      if (!sub.id) {
        console.error("Razorpay returned no subscription ID:", sub);
        return NextResponse.json(
          { error: "Failed to create subscription. Please try again." },
          { status: 502 }
        );
      }

      console.log("Razorpay subscription created:", { subscriptionId: sub.id, plan, billing });

      const rate = await getUsdToInr();
      const chargeUsd = isAnnual ? totalChargeUsd : effectiveMonthlyUsd;
      const subtotalInr = Math.round(chargeUsd * rate);
      const gstAmount = Math.round(subtotalInr * 0.18);
      const totalInrWithGst = subtotalInr + gstAmount;

      return NextResponse.json({
        provider: "razorpay",
        subscriptionId: sub.id,
        razorpayKeyId: razorpayKey,
        amount: totalInrWithGst * 100,
        currency: "INR",
        planName: planConfig.name,
        priceUsd: effectiveMonthlyUsd,
        totalChargeUsd: chargeUsd,
        billing,
        subtotalInr,
        gstAmount,
        totalInr: totalInrWithGst,
      });
    } else {
      // --- Dodo Payments checkout (hosted checkout session) ---
      const dodoRes = await fetch(`${DODO_API_URL}/checkouts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.DODO_API_KEY ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_cart: [{ product_id: dodoPriceId, quantity: 1 }],
          customer: { email, name: email.split("@")[0] },
          return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/payment/success?plan=${plan}&price=${effectiveMonthlyUsd}&billing=${billing}`,
          metadata: { user_id: userId, seer_plan: plan, billing },
        }),
      });

      if (!dodoRes.ok) {
        const errText = await dodoRes.text();
        console.error("Dodo error:", dodoRes.status, errText);
        let detail = "";
        try { detail = JSON.parse(errText)?.message || errText; } catch { detail = errText; }
        return NextResponse.json(
          { error: `Payment error: ${detail}` },
          { status: 502 }
        );
      }

      const dodoData = await dodoRes.json();
      console.log("Dodo checkout created:", dodoData);
      return NextResponse.json({
        provider: "dodo",
        checkoutUrl: dodoData.checkout_url,
        sessionId: dodoData.session_id,
        billing,
      });
    }
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
