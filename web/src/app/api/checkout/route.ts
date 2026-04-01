import { NextRequest, NextResponse } from "next/server";
import { PLANS } from "@/lib/plans";
import { getUsdToInr } from "@/lib/exchange-rate";

const DODO_API_URL = "https://api.dodopayments.com/v1";
const RAZORPAY_API_URL = "https://api.razorpay.com/v1";

function isConfigured(): boolean {
  return !!(process.env.DODO_API_KEY || process.env.RAZORPAY_KEY_ID);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan, userId, email } = body as {
      plan: string;
      userId: string;
      email: string;
    };

    const planConfig = PLANS[plan];
    if (!planConfig) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    if (plan === "free") {
      return NextResponse.json({ error: "Free plan needs no payment" }, { status: 400 });
    }

    // --- DEMO MODE: when payment keys aren't configured ---
    if (!isConfigured()) {
      return NextResponse.json({
        provider: "demo",
        plan: planConfig.name,
        priceUsd: planConfig.priceUsd,
        message: `Payment gateway not configured yet. In production, this will redirect to checkout for the ${planConfig.name} plan at $${planConfig.priceUsd}/mo.`,
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

    // Razorpay is the PRIMARY provider. Use it when:
    // 1. Razorpay key exists AND (user is in India OR no country detected OR Dodo not configured OR dev mode)
    // Only use Dodo for explicitly non-India users when Dodo is configured
    const isIndia = country === "IN" || country === "";
    const useRazorpay = hasRazorpay && (isIndia || !hasDodo || isDev);

    console.log("Checkout routing:", {
      country,
      hasRazorpay,
      hasDodo,
      isDev,
      isIndia,
      useRazorpay,
      plan,
      planId: planConfig.razorpayPlanId,
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

      if (!planConfig.razorpayPlanId) {
        console.error("Razorpay plan ID missing for plan:", plan);
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
          plan_id: planConfig.razorpayPlanId,
          total_count: 12,
          quantity: 1,
          notes: { user_id: userId, email, seer_plan: plan },
        }),
      });

      if (!subRes.ok) {
        const errText = await subRes.text();
        console.error("Razorpay subscription error:", {
          status: subRes.status,
          body: errText,
          planId: planConfig.razorpayPlanId,
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

      console.log("Razorpay subscription created:", { subscriptionId: sub.id, plan });

      const rate = await getUsdToInr();
      const subtotalInr = Math.round(planConfig.priceUsd * rate);
      const gstAmount = Math.round(subtotalInr * 0.18);
      const totalInrWithGst = subtotalInr + gstAmount;

      return NextResponse.json({
        provider: "razorpay",
        subscriptionId: sub.id,
        razorpayKeyId: razorpayKey,
        amount: totalInrWithGst * 100,
        currency: "INR",
        planName: planConfig.name,
        priceUsd: planConfig.priceUsd,
        subtotalInr,
        gstAmount,
        totalInr: totalInrWithGst,
      });
    } else {
      // --- Dodo Payments checkout ---
      const dodoRes = await fetch(`${DODO_API_URL}/subscriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.DODO_API_KEY ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          billing: { city: "", country, state: "", street: "", zipcode: "" },
          customer: { email, name: email.split("@")[0] },
          payment_link: true,
          product_id: planConfig.dodoPriceId,
          quantity: 1,
          return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard?payment=success`,
          metadata: { user_id: userId, seer_plan: plan },
        }),
      });

      if (!dodoRes.ok) {
        const err = await dodoRes.text();
        console.error("Dodo error:", err);
        return NextResponse.json(
          { error: "Payment provider error. Please try again." },
          { status: 502 }
        );
      }

      const dodoData = await dodoRes.json();
      return NextResponse.json({
        provider: "dodo",
        checkoutUrl: dodoData.payment_link,
        subscriptionId: dodoData.subscription_id,
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
