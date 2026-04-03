/**
 * Server-side team conflict detection.
 * Runs inside the MCP server — no curl needed.
 * Checks if another agency member is working on the same feature and
 * returns an instant warning string for Claude to display.
 */

import { supabase } from "./supabase.js";
import type { SeerUser } from "./auth.js";

/** Extract a short feature label (2-5 words) from a user command. */
function extractFeatureLabel(input: string): string | null {
  const trimmed = input.trim().toLowerCase();

  // Skip generic commands — no feature to detect
  const skipPatterns = /^(continue|resume|status|recall|what did i|where was i|where did i|help|tools|show tools|list tools|features|pick up|what's next|whats next|session read|memory run)$/i;
  if (skipPatterns.test(trimmed)) return null;

  // Remove common SEER prefixes
  let cleaned = trimmed
    .replace(/^(build|create|add|fix|implement|refactor|update|remove|delete|wire|test|debug|deploy)\s+/i, "$1 ")
    .replace(/\s+(for|in|on|of|the|a|an|to|from|with|into|at)\s+/g, " ")
    .trim();

  // Take first 5 meaningful words
  const words = cleaned.split(/\s+/).filter(w => w.length > 1).slice(0, 5);
  if (words.length === 0) return null;

  return words.join(" ");
}

/** Check for team conflicts and return a warning string (or empty). */
export async function checkTeamConflict(
  user: SeerUser,
  input: string
): Promise<{ warning: string; featureLabel: string | null }> {
  const featureLabel = extractFeatureLabel(input);
  if (!featureLabel) return { warning: "", featureLabel: null };

  try {
    // Find user's agency
    let agencyId: string | null = null;

    const { data: membership } = await supabase
      .from("agency_users")
      .select("agency_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (membership) {
      agencyId = membership.agency_id;
    } else {
      const { data: ownedAgency } = await supabase
        .from("agencies")
        .select("id")
        .eq("owner_id", user.id)
        .eq("status", "active")
        .limit(1)
        .single();

      if (ownedAgency) agencyId = ownedAgency.id;
    }

    if (!agencyId) return { warning: "", featureLabel };

    // Upsert this user's activity
    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from("agency_activity")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("user_id", user.id)
      .match({ project_name: "mcp-session" })
      .single();

    const activityData = {
      agency_id: agencyId,
      user_id: user.id,
      project_name: "mcp-session",
      feature_label: featureLabel,
      status: "active" as const,
      last_seen: now,
    };

    if (existing) {
      await supabase
        .from("agency_activity")
        .update({ feature_label: featureLabel, status: "active", last_seen: now })
        .eq("id", existing.id);
    } else {
      await supabase.from("agency_activity").insert(activityData);
    }

    // Detect conflicts — other active users on overlapping features
    const idleCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: others } = await supabase
      .from("agency_activity")
      .select("user_id, feature_label, project_name, users!agency_activity_user_id_fkey(email)")
      .eq("agency_id", agencyId)
      .eq("status", "active")
      .gt("last_seen", idleCutoff)
      .neq("user_id", user.id);

    if (!others || others.length === 0) return { warning: "", featureLabel };

    const normalizedFeature = featureLabel.toLowerCase().trim();
    const featureWords = normalizedFeature.split(/\s+/).filter(w => w.length > 2);

    const conflicts: Array<{ email: string; feature: string; project: string }> = [];

    for (const other of others) {
      const otherFeature = (other.feature_label ?? "").toLowerCase().trim();
      if (!otherFeature) continue;

      const otherWords = otherFeature.split(/\s+/).filter((w: string) => w.length > 2);

      // Check for overlap: exact match, containment, or significant word overlap
      const isExact = otherFeature === normalizedFeature;
      const isContained = otherFeature.includes(normalizedFeature) || normalizedFeature.includes(otherFeature);
      const commonWords = featureWords.filter((w: string) => otherWords.includes(w));
      const hasWordOverlap = commonWords.length >= Math.min(2, featureWords.length);

      if (isExact || isContained || hasWordOverlap) {
        conflicts.push({
          email: (other as any).users?.email ?? "a team member",
          feature: other.feature_label ?? featureLabel,
          project: other.project_name ?? "unknown",
        });
      }
    }

    if (conflicts.length === 0) return { warning: "", featureLabel };

    // Build warning
    const lines: string[] = [
      "",
      "IMPORTANT: You MUST display this team conflict warning to the user IMMEDIATELY. Do NOT skip it.",
      "",
      "---",
      "⚠️ **Team Conflict Detected!**",
      "",
    ];

    for (const c of conflicts) {
      lines.push(`**@${c.email}** is already working on **"${c.feature}"** right now.`);
    }

    lines.push("");
    lines.push("Consider coordinating with them or switching to a different feature to avoid duplicate work.");
    lines.push("---");
    lines.push("");

    return { warning: lines.join("\n"), featureLabel };
  } catch (err) {
    // Conflict detection is best-effort — never block the tool
    console.error("Conflict detection error:", err);
    return { warning: "", featureLabel };
  }
}
