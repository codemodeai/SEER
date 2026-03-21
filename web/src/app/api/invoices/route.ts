import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
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

    const admin = getSupabaseAdmin();

    const { data: invoices } = await admin
      .from("invoices")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Get subscription info for next billing date
    const { data: sub } = await admin
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    // Calculate next billing date (1 month from last invoice or subscription start)
    let nextBillingDate = null;
    if (sub) {
      const lastInvoice = invoices?.[0];
      if (lastInvoice) {
        const lastDate = new Date(lastInvoice.billing_period_end || lastInvoice.created_at);
        nextBillingDate = lastDate.toISOString();
      } else {
        // No invoices yet, next billing is 1 month from now
        const next = new Date();
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
        nextBillingDate = next.toISOString();
      }
    }

    return NextResponse.json({
      invoices: invoices ?? [],
      nextBillingDate,
      subscription: sub ?? null,
    });
  } catch (err) {
    console.error("Invoices fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}
