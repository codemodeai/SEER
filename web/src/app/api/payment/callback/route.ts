import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const razorpay_payment_id = formData.get("razorpay_payment_id") as string;
    const razorpay_subscription_id = formData.get("razorpay_subscription_id") as string;
    const razorpay_signature = formData.get("razorpay_signature") as string;

    const plan = req.nextUrl.searchParams.get("plan") ?? "";
    const price = req.nextUrl.searchParams.get("price") ?? "0";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature || !plan) {
      return NextResponse.redirect(`${appUrl}/dashboard/billing?error=missing_payment_details`, 303);
    }

    // Verify signature
    const secret = (process.env.RAZORPAY_KEY_SECRET ?? "").trim();
    const generatedSig = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest("hex");

    if (generatedSig !== razorpay_signature) {
      return NextResponse.redirect(`${appUrl}/dashboard/billing?error=invalid_signature`, 303);
    }

    // Get authenticated user
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
      return NextResponse.redirect(`${appUrl}/login?error=not_authenticated`, 303);
    }

    // Update user plan
    const admin = getSupabaseAdmin();

    await admin
      .from("users")
      .update({ plan, usage_this_month: 0 })
      .eq("id", user.id);

    await admin.from("subscriptions").upsert(
      {
        user_id: user.id,
        provider: "razorpay",
        provider_sub_id: razorpay_subscription_id,
        plan,
        status: "active",
      },
      { onConflict: "user_id,provider" }
    );

    // Create invoice
    const USD_PRICES: Record<string, number> = { starter: 19, pro: 49, agency: 99 };
    const INR_PRICES: Record<string, number> = { starter: 1599, pro: 3999, agency: 7999 };
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    await admin.from("invoices").insert({
      user_id: user.id,
      plan,
      amount_usd: USD_PRICES[plan] ?? 0,
      amount_inr: INR_PRICES[plan] ?? 0,
      status: "paid",
      payment_id: razorpay_payment_id,
      provider: "razorpay",
      billing_period_start: periodStart.toISOString(),
      billing_period_end: periodEnd.toISOString(),
    });

    return NextResponse.redirect(`${appUrl}/payment/success?plan=${plan}&price=${price}`, 303);
  } catch (err) {
    console.error("Payment callback error:", err);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/dashboard/billing?error=callback_failed`, 303);
  }
}
