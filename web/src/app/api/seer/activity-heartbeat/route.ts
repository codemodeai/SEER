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

      const conflicts = await detectConflicts(admin, agencyId, user.id, projectName, featureLabel);
      return NextResponse.json({ success: true, action: "updated", conflicts });
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

      const conflicts = await detectConflicts(admin, agencyId, user.id, projectName, featureLabel);
      return NextResponse.json({ success: true, action: "created", conflicts });
    }
  } catch (err) {
    console.error("Activity heartbeat error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Detect team members working on the same feature in the same project
async function detectConflicts(
  admin: ReturnType<typeof getSupabaseAdmin>,
  agencyId: string,
  currentUserId: string,
  projectName: string,
  featureLabel: string
): Promise<Array<{ email: string; feature: string; project: string }>> {
  if (!featureLabel) return [];

  const idleCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  // Find other active users on the same project with overlapping feature
  const { data: others } = await admin
    .from("agency_activity")
    .select("user_id, feature_label, users!agency_activity_user_id_fkey(email)")
    .eq("agency_id", agencyId)
    .eq("project_name", projectName)
    .eq("status", "active")
    .gt("last_seen", idleCutoff)
    .neq("user_id", currentUserId);

  if (!others || others.length === 0) return [];

  const normalizedFeature = featureLabel.toLowerCase().trim();
  const conflicts: Array<{ email: string; feature: string; project: string }> = [];

  for (const other of others) {
    const otherFeature = (other.feature_label ?? "").toLowerCase().trim();
    if (!otherFeature) continue;

    // Exact match or significant overlap (one contains the other)
    if (
      otherFeature === normalizedFeature ||
      otherFeature.includes(normalizedFeature) ||
      normalizedFeature.includes(otherFeature)
    ) {
      conflicts.push({
        email: (other as any).users?.email ?? "a team member",
        feature: other.feature_label ?? featureLabel,
        project: projectName,
      });
    }
  }

  return conflicts;
}
