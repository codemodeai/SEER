import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { checkAgencyFeature } from "@/lib/agency-features";
import { fireWebhooks } from "@/lib/webhook-deliver";

// POST /api/agency/[slug]/webhooks/test — send a test ping to a specific webhook
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data: agency } = await admin
      .from("agencies")
      .select("id, owner_id")
      .eq("slug", slug)
      .single();

    if (!agency) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    // Check owner or admin
    const isOwner = agency.owner_id === user.id;
    if (!isOwner) {
      const { data: membership } = await admin
        .from("agency_users")
        .select("role")
        .eq("agency_id", agency.id)
        .eq("user_id", user.id)
        .single();
      if (!membership || membership.role === "member") {
        return NextResponse.json({ error: "Only owner/admin can test webhooks" }, { status: 403 });
      }
    }

    const { enabled } = await checkAgencyFeature(agency.id, "webhooks");
    if (!enabled) {
      return NextResponse.json({ error: "Webhooks feature is not enabled" }, { status: 403 });
    }

    // Fire a test event — uses the first subscribed event of the webhook, or member.joined as fallback
    await fireWebhooks(agency.id, "member.joined", {
      test: true,
      message: "This is a test webhook delivery from SEER",
      triggered_by: user.email,
    });

    return NextResponse.json({ success: true, message: "Test webhook sent" });
  } catch (err) {
    console.error("Webhook test error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
