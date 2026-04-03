import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

// POST /api/seer/activity-heartbeat — auto-heartbeat from MCP tools
// Authenticates via sk-seer- API key (no cookies/session needed)
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    let apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();

    const body = await req.json();
    if (!apiKey) apiKey = (body.api_key ?? "").trim();

    if (!apiKey || !apiKey.startsWith("sk-seer-")) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const projectName = String(body.project_name ?? "").trim();
    const featureLabel = String(body.feature_label ?? "").trim();

    if (!projectName) {
      return NextResponse.json({ error: "project_name is required" }, { status: 400 });
    }
    if (projectName.length > 100) {
      return NextResponse.json({ error: "project_name too long" }, { status: 400 });
    }
    if (featureLabel.length > 200) {
      return NextResponse.json({ error: "feature_label too long" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Authenticate user by API key
    const { data: user } = await admin
      .from("users")
      .select("id")
      .eq("seer_api_key", apiKey)
      .single();

    if (!user) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    // Find user's agency
    let agencyId: string | null = null;

    const { data: membership } = await admin
      .from("agency_users")
      .select("agency_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (membership) {
      agencyId = membership.agency_id;
    } else {
      const { data: ownedAgency } = await admin
        .from("agencies")
        .select("id")
        .eq("owner_id", user.id)
        .eq("status", "active")
        .limit(1)
        .single();

      if (ownedAgency) agencyId = ownedAgency.id;
    }

    if (!agencyId) {
      return NextResponse.json({ success: true, action: "skipped", reason: "no_agency" });
    }

    // Upsert activity
    const now = new Date().toISOString();
    const { data: existing } = await admin
      .from("agency_activity")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("user_id", user.id)
      .eq("project_name", projectName)
      .single();

    if (existing) {
      const update: Record<string, string> = { status: "active", last_seen: now };
      if (featureLabel) update.feature_label = featureLabel;

      const { error: updateErr } = await admin
        .from("agency_activity")
        .update(update)
        .eq("id", existing.id);

      if (updateErr) {
        console.error("Heartbeat update error:", updateErr);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
      }
      return NextResponse.json({ success: true, action: "updated" });
    } else {
      const { error: insertErr } = await admin
        .from("agency_activity")
        .insert({
          agency_id: agencyId,
          user_id: user.id,
          project_name: projectName,
          feature_label: featureLabel || null,
          status: "active",
          last_seen: now,
        });

      if (insertErr) {
        console.error("Heartbeat insert error:", insertErr);
        return NextResponse.json({ error: "Failed to create" }, { status: 500 });
      }
      return NextResponse.json({ success: true, action: "created" });
    }
  } catch (err) {
    console.error("Activity heartbeat error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
