import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { usdToInr } from "@/lib/exchange-rate";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const razorpay_payment_id = formData.get("razorpay_payment_id") as string;
    const razorpay_subscription_id = formData.get("razorpay_subscription_id") as string;
    const razorpay_signature = formData.get("razorpay_signature") as string;

    const plan = req.nextUrl.searchParams.get("plan") ?? "";
    const price = req.nextUrl.searchParams.get("price") ?? "0";
    const billing = req.nextUrl.searchParams.get("billing") ?? "monthly";
    const isAnnual = billing === "annual";
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

    const { error: updateError } = await admin
      .from("users")
      .update({ plan, usage_this_month: 0 })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to update user plan:", updateError);
      return NextResponse.redirect(`${appUrl}/dashboard/billing?error=plan_update_failed`, 303);
    }

    const { error: subError } = await admin.from("subscriptions").upsert(
      {
        user_id: user.id,
        provider: "razorpay",
        provider_sub_id: razorpay_subscription_id,
        plan,
        status: "active",
        billing_cycle: billing,
      },
      { onConflict: "user_id,provider" }
    );

    if (subError) {
      console.error("Failed to upsert subscription:", subError);
    }

    // Create invoice
    const USD_MONTHLY: Record<string, number> = { starter: 19, pro: 49, agency: 99 };
    const USD_ANNUAL: Record<string, number> = { starter: 15, pro: 39, agency: 79 };
    const monthlyUsd = (isAnnual ? USD_ANNUAL : USD_MONTHLY)[plan] ?? 0;
    const amountUsd = isAnnual ? monthlyUsd * 12 : monthlyUsd;
    const amountInr = await usdToInr(amountUsd);
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = isAnnual
      ? new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), 0))
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

    const { error: invoiceError } = await admin.from("invoices").insert({
      user_id: user.id,
      plan,
      amount_usd: amountUsd,
      amount_inr: amountInr,
      status: "paid",
      payment_id: razorpay_payment_id,
      provider: "razorpay",
      billing_period_start: periodStart.toISOString(),
      billing_period_end: periodEnd.toISOString(),
    });

    if (invoiceError) {
      console.error("Failed to create invoice:", invoiceError);
    }

    return NextResponse.redirect(`${appUrl}/payment/success?plan=${plan}&price=${price}&billing=${billing}`, 303);
  } catch (err) {
    console.error("Payment callback error:", err);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/dashboard/billing?error=callback_failed`, 303);
  }
}
