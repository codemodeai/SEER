/**
 * Plan-tier gateway for memory selection.
 *
 * Starter / free → cheap-first SQL/full-text search; embedding fallback only
 * when the SQL path returns < 3 hits.
 * Pro / agency   → always-embed; richer ranking but every request costs one
 * Haiku-tier embedding call (≈ $0.00002).
 *
 * Single read site keeps the policy in one place; future tiers (e.g. local
 * embedder) drop in here without touching the tools.
 */

import type { SeerUser } from "./auth.js";

export type SelectionMode = "sql_first" | "always_embed";

export function selectionMode(user: Pick<SeerUser, "plan">): SelectionMode {
  switch (user.plan) {
    case "pro":
    case "agency":
      return "always_embed";
    case "free":
    case "starter":
    default:
      return "sql_first";
  }
}
