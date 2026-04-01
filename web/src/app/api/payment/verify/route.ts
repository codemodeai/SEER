import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAgencyForUser } from "@/lib/create-agency";

export async function POST(req: NextRequest) {
  try {
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
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const {
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature,
      plan,
      agencyConfig,
    } = body as {
      razorpay_payment_id: string;
      razorpay_subscription_id: string;
      razorpay_signature: string;
      plan: string;
      agencyConfig?: {
        agencyName: string;
        memberTier: string;
        maxUsers: number;
        basePrice: number;
        addonPrice: number;
        enabledFeatures: Record<string, boolean>;
      };
    };

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature || !plan) {
      return NextResponse.json({ error: "Missing payment details" }, { status: 400 });
    }

    // Verify Razorpay signature
    const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
    const generatedSig = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest("hex");

    if (generatedSig !== razorpay_signature) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    // Update user plan
    const admin = getSupabaseAdmin();

    const { error: updateError } = await admin
      .from("users")
      .update({ plan, usage_this_month: 0 })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to update user plan:", updateError);
      return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
    }

    const { error: subError } = await admin.from("subscriptions").upsert(
      {
        user_id: user.id,
        provider: "razorpay",
        provider_sub_id: razorpay_subscription_id,
        plan,
        status: "active",
      },
      { onConflict: "user_id,provider" }
    );

    if (subError) {
      console.error("Failed to upsert subscription:", subError);
    }

    // Create invoice for this payment
    const agencyTotal = agencyConfig ? agencyConfig.basePrice + agencyConfig.addonPrice : 0;
    const USD_PRICES: Record<string, number> = { starter: 19, pro: 49, agency: agencyTotal || 59 };
    const INR_PRICES: Record<string, number> = { starter: 1599, pro: 3999, agency: (agencyTotal || 59) * 85 };
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const { error: invoiceError } = await admin.from("invoices").insert({
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

    if (invoiceError) {
      console.error("Failed to create invoice:", invoiceError);
    }

    // Auto-create agency for agency plan subscribers
    let agencySlug: string | null = null;
    if (plan === "agency") {
      const agency = await createAgencyForUser(admin, user.id, user.email ?? "");
      agencySlug = agency?.slug ?? null;

      // Update agency with tier, pricing, and feature config from setup
      if (agency && agencyConfig) {
        await admin
          .from("agencies")
          .update({
            name: agencyConfig.agencyName,
            max_users: agencyConfig.maxUsers,
            member_tier: agencyConfig.memberTier,
            base_price: agencyConfig.basePrice,
            addon_price: agencyConfig.addonPrice,
            enabled_features: agencyConfig.enabledFeatures,
          })
          .eq("id", agency.id);
      }
    }

    return NextResponse.json({ success: true, plan, agencySlug });
  } catch (err) {
    console.error("Payment verify error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
