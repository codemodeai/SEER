import type { SeerUser } from "./auth.js";
import { supabase } from "./supabase.js";

export interface MfaCheckResult {
  blocked: boolean;
  nudge: string | null;
}

const MFA_NUDGE_INTERVAL = 5;
const MFA_HARD_BLOCK_AT = 20;

function softNudge(count: number): string {
  const remaining = MFA_HARD_BLOCK_AT - count;
  return `\n\n---\n**Secure your account** (${count}/${MFA_HARD_BLOCK_AT} calls used) — Set up two-factor authentication in your [Dashboard → Security](https://seer.sh/dashboard/security) settings. ${remaining <= 5 ? `**Only ${remaining} calls left before SEER is blocked.**` : "It only takes 30 seconds."}\n---`;
}

const HARD_BLOCK = JSON.stringify({
  error: "MFA required",
  message: "You've used 20+ SEER commands. Please set up two-factor authentication to continue.",
  action: "Visit your Dashboard → Security page to enable TOTP: https://seer.sh/dashboard/security",
  help: "This is a one-time setup. After enabling MFA, SEER will never interrupt you again.",
});

/**
 * Check MFA status and increment prompt_count.
 * - mfa_verified = true → always pass, no nudges, no blocks
 * - prompt_count >= 5 and < 20 → soft nudge on every call
 * - prompt_count >= 20 → hard block
 */
export async function checkMfa(user: SeerUser): Promise<MfaCheckResult> {
  // Already verified — lifetime pass
  if (user.mfa_verified) {
    return { blocked: false, nudge: null };
  }

  const newCount = (user.prompt_count ?? 0) + 1;

  // Increment prompt_count in DB
  await supabase
    .from("users")
    .update({ prompt_count: newCount })
    .eq("id", user.id);

  // Hard block at 20+
  if (newCount >= MFA_HARD_BLOCK_AT) {
    return { blocked: true, nudge: null };
  }

  // Soft nudge on every call from 5 onwards (5, 6, 7, ... 19)
  if (newCount >= MFA_NUDGE_INTERVAL) {
    return { blocked: false, nudge: softNudge(newCount) };
  }

  return { blocked: false, nudge: null };
}

/** Returns the hard block message for tools to return directly */
export function getMfaBlockMessage(): string {
  return HARD_BLOCK;
}
