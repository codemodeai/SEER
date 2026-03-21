import { NextRequest, NextResponse } from "next/server";
import { PLANS } from "@/lib/plans";

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
        priceInr: planConfig.priceInr,
        message: `Payment gateway not configured yet. In production, this will redirect to checkout for the ${planConfig.name} plan at $${planConfig.priceUsd}/mo.`,
      });
    }

    // Detect country from request headers (Vercel provides this)
    const country =
      req.headers.get("x-vercel-ip-country") ??
      req.headers.get("cf-ipcountry") ??
      "US";
    const isIndia = country === "IN";

    // Use Razorpay if user is in India, OR if Dodo isn't configured
    const useRazorpay =
      (isIndia || !process.env.DODO_API_KEY) && !!process.env.RAZORPAY_KEY_ID;

    if (useRazorpay) {
      // --- Razorpay subscription ---
      const razorpayKey = process.env.RAZORPAY_KEY_ID;
      const razorpaySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
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
        const err = await subRes.text();
        console.error("Razorpay error:", err);
        return NextResponse.json(
          { error: "Payment provider error. Please try again." },
          { status: 502 }
        );
      }

      const sub = await subRes.json();
      return NextResponse.json({
        provider: "razorpay",
        subscriptionId: sub.id,
        razorpayKeyId: razorpayKey,
        amount: planConfig.priceInr * 100,
        currency: "INR",
        planName: planConfig.name,
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
