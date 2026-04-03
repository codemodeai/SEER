import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import crypto from "crypto";

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

// POST /api/seer/memory-sync — auto-sync .seer_memory.md from MCP tools
// Authenticates via sk-seer- API key (no cookies/session needed)
export async function POST(req: NextRequest) {
  try {
    // Extract API key from Authorization header or body
    const authHeader = req.headers.get("authorization") ?? "";
    let apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();

    const body = await req.json();
    if (!apiKey) apiKey = (body.api_key ?? "").trim();

    if (!apiKey || !apiKey.startsWith("sk-seer-")) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const projectName = String(body.project_name ?? "").trim();
    const content = String(body.content ?? "");

    if (!projectName) {
      return NextResponse.json({ error: "project_name is required" }, { status: 400 });
    }
    if (projectName.length > 100) {
      return NextResponse.json({ error: "project_name must be under 100 characters" }, { status: 400 });
    }
    if (content.length > 512000) {
      return NextResponse.json({ error: "Content exceeds 500KB limit" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Authenticate user by API key
    const { data: user } = await admin
      .from("users")
      .select("id, email, plan")
      .eq("seer_api_key", apiKey)
      .single();

    if (!user) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    // Find user's agency (member or owner)
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
      // User not in any agency — silently succeed (non-agency users just skip)
      return NextResponse.json({ success: true, action: "skipped", reason: "no_agency" });
    }

    const contentHash = sha256(content);

    // Check if project exists
    const { data: existing } = await admin
      .from("agency_projects")
      .select("id, version, content_hash")
      .eq("agency_id", agencyId)
      .eq("project_name", projectName)
      .single();

    if (existing) {
      // Skip if unchanged
      if (existing.content_hash === contentHash) {
        return NextResponse.json({ success: true, action: "unchanged", version: existing.version });
      }

      // Update
      const newVersion = existing.version + 1;
      const { error: updateErr } = await admin
        .from("agency_projects")
        .update({
          cloud_memory: content,
          content_hash: contentHash,
          version: newVersion,
          updated_by: user.id,
        })
        .eq("id", existing.id);

      if (updateErr) {
        console.error("Memory sync update error:", updateErr);
        return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: "updated", version: newVersion });
    } else {
      // Create new
      const { error: insertErr } = await admin
        .from("agency_projects")
        .insert({
          agency_id: agencyId,
          project_name: projectName,
          cloud_memory: content,
          content_hash: contentHash,
          version: 1,
          updated_by: user.id,
        });

      if (insertErr) {
        console.error("Memory sync insert error:", insertErr);
        return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: "created", version: 1 });
    }
  } catch (err) {
    console.error("Memory sync error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
