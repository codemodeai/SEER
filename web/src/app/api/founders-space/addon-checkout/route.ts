import { NextRequest, NextResponse } from "next/server";
import { getUsdToInr } from "@/lib/exchange-rate";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const FS_ADDON_PRICE_USD = 1;

// POST /api/founders-space/addon-checkout — $1/mo Founder's Space addon for Starter users
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, email, preferredProvider } = body;

    if (!userId || !email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Verify user is on starter plan and doesn't already have fs_access
    const { data: userData } = await admin
      .from("users")
      .select("plan, fs_access")
      .eq("id", userId)
      .single();

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (userData.fs_access) {
      return NextResponse.json({ error: "Founder's Space is already enabled" }, { status: 400 });
    }

    if (userData.plan !== "starter") {
      if (userData.plan === "pro" || userData.plan === "agency") {
        // Auto-enable for Pro/Agency — it's included
        await admin.from("users").update({ fs_access: true }).eq("id", userId);
        return NextResponse.json({ provider: "free", message: "Founder's Space enabled — included with your plan.", enabled: true });
      }
      return NextResponse.json({ error: "Upgrade to Starter or higher first" }, { status: 400 });
    }

    const hasRazorpay = !!process.env.RAZORPAY_KEY_ID;
    const hasDodo = !!process.env.DODO_API_KEY;

    if (!hasRazorpay && !hasDodo) {
      // Dev mode — enable directly
      await admin.from("users").update({ fs_access: true }).eq("id", userId);
      return NextResponse.json({
        provider: "free",
        message: "Founder's Space enabled (dev mode — no payment gateway configured).",
        enabled: true,
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const useDodo = preferredProvider === "dodo" && hasDodo;

    if (useDodo) {
      const DODO_API_URL = process.env.DODO_API_KEY?.startsWith("sk_live")
        ? "https://live.dodopayments.com"
        : "https://test.dodopayments.com";

      const addonProductId = process.env.DODO_ADDON_FS_PRICE_ID ?? "";
      if (!addonProductId) {
        return NextResponse.json({ error: "Founder's Space addon product not configured" }, { status: 500 });
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
          return_url: `${appUrl}/dashboard/founders-space?addon_enabled=true`,
          metadata: {
            user_id: userId,
            type: "fs_addon",
          },
        }),
      });

      if (!dodoRes.ok) {
        const errText = await dodoRes.text();
        console.error("Dodo FS addon checkout error:", dodoRes.status, errText);
        return NextResponse.json({ error: "Payment error" }, { status: 502 });
      }

      const dodoData = await dodoRes.json();
      return NextResponse.json({ provider: "dodo", checkoutUrl: dodoData.checkout_url });
    }

    // Razorpay
    const razorpayKey = process.env.RAZORPAY_KEY_ID?.trim();
    const razorpaySecret = (process.env.RAZORPAY_KEY_SECRET ?? "").trim();

    if (!razorpayKey || !razorpaySecret) {
      return NextResponse.json({ error: "Payment not configured" }, { status: 500 });
    }

    const RAZORPAY_API_URL = "https://api.razorpay.com/v1";
    const auth = Buffer.from(`${razorpayKey}:${razorpaySecret}`).toString("base64");
    const rate = await getUsdToInr();
    const subtotalInr = Math.round(FS_ADDON_PRICE_USD * rate);
    const gstAmount = Math.round(subtotalInr * 0.18);
    const totalPaise = (subtotalInr + gstAmount) * 100;

    // Create Razorpay plan
    const planRes = await fetch(`${RAZORPAY_API_URL}/plans`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        period: "monthly",
        interval: 1,
        item: {
          name: "SEER Founder's Space Add-on",
          amount: totalPaise,
          currency: "INR",
          description: "Founder's Space workspace addon ($1/mo)",
        },
      }),
    });

    if (!planRes.ok) {
      console.error("Razorpay FS addon plan error:", await planRes.text());
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
          type: "fs_addon",
        },
      }),
    });

    if (!subRes.ok) {
      console.error("Razorpay FS addon sub error:", await subRes.text());
      return NextResponse.json({ error: "Failed to create subscription" }, { status: 502 });
    }
    const subData = await subRes.json();

    return NextResponse.json({
      provider: "razorpay",
      subscriptionId: subData.id,
      razorpayKeyId: razorpayKey,
      planName: "Founder's Space",
      priceUsd: FS_ADDON_PRICE_USD,
    });
  } catch (err) {
    console.error("FS addon checkout error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
