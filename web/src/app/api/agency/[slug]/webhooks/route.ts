import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { checkAgencyFeature } from "@/lib/agency-features";
import { WEBHOOK_EVENTS, type WebhookEvent } from "@/lib/webhook-deliver";
import crypto from "crypto";

async function getAgencyAndRole(slug: string, userId: string) {
  const admin = getSupabaseAdmin();
  const { data: agency } = await admin
    .from("agencies")
    .select("id, owner_id")
    .eq("slug", slug)
    .single();

  if (!agency) return null;

  const isOwner = agency.owner_id === userId;
  if (isOwner) return { agency, role: "owner" as const };

  const { data: membership } = await admin
    .from("agency_users")
    .select("role")
    .eq("agency_id", agency.id)
    .eq("user_id", userId)
    .single();

  if (!membership) return null;
  return { agency, role: membership.role as "admin" | "member" };
}

async function authenticate(slug: string) {
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
  if (!user) return { error: "Not authenticated", status: 401 };

  const result = await getAgencyAndRole(slug, user.id);
  if (!result) return { error: "Access denied", status: 403 };
  if (result.role === "member") return { error: "Only owner/admin can manage webhooks", status: 403 };

  const { enabled } = await checkAgencyFeature(result.agency.id, "webhooks");
  if (!enabled) return { error: "Webhooks feature is not enabled for this agency", status: 403 };

  return { user, agency: result.agency, role: result.role };
}

const validEvents = Object.keys(WEBHOOK_EVENTS) as WebhookEvent[];

// GET /api/agency/[slug]/webhooks — list webhooks + recent deliveries
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const auth = await authenticate(slug);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const admin = getSupabaseAdmin();
    const { data: webhooks } = await admin
      .from("agency_webhooks")
      .select("id, url, events, active, description, created_at, updated_at")
      .eq("agency_id", auth.agency.id)
      .order("created_at", { ascending: false });

    // Get last 5 deliveries per webhook for status preview
    const webhookIds = (webhooks ?? []).map((w: any) => w.id);
    let deliveries: any[] = [];
    if (webhookIds.length > 0) {
      const { data } = await admin
        .from("agency_webhook_deliveries")
        .select("id, webhook_id, event, success, status_code, attempted_at")
        .in("webhook_id", webhookIds)
        .order("attempted_at", { ascending: false })
        .limit(50);
      deliveries = data ?? [];
    }

    // Group deliveries by webhook
    const deliveryMap: Record<string, any[]> = {};
    for (const d of deliveries) {
      if (!deliveryMap[d.webhook_id]) deliveryMap[d.webhook_id] = [];
      if (deliveryMap[d.webhook_id].length < 5) deliveryMap[d.webhook_id].push(d);
    }

    const enriched = (webhooks ?? []).map((w: any) => ({
      ...w,
      recentDeliveries: deliveryMap[w.id] ?? [],
    }));

    return NextResponse.json({ webhooks: enriched, availableEvents: WEBHOOK_EVENTS });
  } catch (err) {
    console.error("Webhooks GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/agency/[slug]/webhooks — create webhook
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const auth = await authenticate(slug);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const url = (body.url ?? "").trim();
    const events: string[] = body.events ?? [];
    const description = (body.description ?? "").trim();

    // Validate URL
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }
    try {
      const parsed = new URL(url);
      if (!["https:", "http:"].includes(parsed.protocol)) {
        return NextResponse.json({ error: "URL must use HTTPS or HTTP" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Validate events
    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: "At least one event is required" }, { status: 400 });
    }
    const invalidEvents = events.filter((e) => !validEvents.includes(e as WebhookEvent));
    if (invalidEvents.length > 0) {
      return NextResponse.json({ error: `Invalid events: ${invalidEvents.join(", ")}` }, { status: 400 });
    }

    if (description.length > 200) {
      return NextResponse.json({ error: "Description must be under 200 characters" }, { status: 400 });
    }

    // Limit to 10 webhooks per agency
    const admin = getSupabaseAdmin();
    const { count } = await admin
      .from("agency_webhooks")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", auth.agency.id);

    if ((count ?? 0) >= 10) {
      return NextResponse.json({ error: "Maximum 10 webhooks per agency" }, { status: 400 });
    }

    // Generate signing secret
    const secret = crypto.randomBytes(32).toString("hex");

    const { data: webhook, error: insertErr } = await admin
      .from("agency_webhooks")
      .insert({
        agency_id: auth.agency.id,
        url,
        secret,
        events,
        description,
        active: true,
      })
      .select("id, url, secret, events, active, description, created_at")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ webhook }, { status: 201 });
  } catch (err) {
    console.error("Webhooks POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH /api/agency/[slug]/webhooks — update webhook
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const auth = await authenticate(slug);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const { webhook_id } = body;
    if (!webhook_id) {
      return NextResponse.json({ error: "webhook_id required" }, { status: 400 });
    }

    const updates: Record<string, any> = {};

    if (body.url !== undefined) {
      const url = body.url.trim();
      try {
        const parsed = new URL(url);
        if (!["https:", "http:"].includes(parsed.protocol)) {
          return NextResponse.json({ error: "URL must use HTTPS or HTTP" }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
      }
      updates.url = url;
    }

    if (body.events !== undefined) {
      if (!Array.isArray(body.events) || body.events.length === 0) {
        return NextResponse.json({ error: "At least one event is required" }, { status: 400 });
      }
      const invalidEvents = body.events.filter((e: string) => !validEvents.includes(e as WebhookEvent));
      if (invalidEvents.length > 0) {
        return NextResponse.json({ error: `Invalid events: ${invalidEvents.join(", ")}` }, { status: 400 });
      }
      updates.events = body.events;
    }

    if (body.active !== undefined) {
      updates.active = body.active === true;
    }

    if (body.description !== undefined) {
      if (body.description.length > 200) {
        return NextResponse.json({ error: "Description must be under 200 characters" }, { status: 400 });
      }
      updates.description = body.description;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error: updateErr } = await admin
      .from("agency_webhooks")
      .update(updates)
      .eq("id", webhook_id)
      .eq("agency_id", auth.agency.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhooks PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/agency/[slug]/webhooks — delete webhook
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const auth = await authenticate(slug);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const webhookId = req.nextUrl.searchParams.get("webhook_id");
    if (!webhookId) {
      return NextResponse.json({ error: "webhook_id required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error: deleteErr } = await admin
      .from("agency_webhooks")
      .delete()
      .eq("id", webhookId)
      .eq("agency_id", auth.agency.id);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhooks DELETE error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
