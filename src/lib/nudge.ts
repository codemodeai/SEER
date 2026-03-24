import { supabase } from "./supabase.js";

const NUDGE_KEYWORDS = [
  "EOD",
  "end of day",
  "today I",
  "wrap up",
  "this week I",
  "save this",
  "remember this",
  "note this",
  "log this",
  "record this",
  "I just finished",
  "just built",
  "just added",
  "done with",
  "completed",
  "report",
  "summary",
  "update the doc",
  "push this",
];

const THROTTLE_MS = 30 * 60 * 1000; // 30 minutes

const NUDGE_TEXT = `SEER \u00b7 suggestion
Looks like you just completed something important. Use \`seer session read\` to save this session to your project memory, or use \`seer [your next task]\` to continue with full context tracking from here.`;

export interface NudgeResult {
  shouldNudge: boolean;
  nudgeText?: string;
}

export async function checkNudge(
  input: string,
  userId: string,
  lastNudgeAt: string | null
): Promise<NudgeResult> {
  // Don't nudge if already using seer
  const lowerInput = input.toLowerCase();

  // Check keyword match (case-insensitive)
  const hasKeyword = NUDGE_KEYWORDS.some((kw) =>
    lowerInput.includes(kw.toLowerCase())
  );

  if (!hasKeyword) {
    return { shouldNudge: false };
  }

  // Check throttle — max once per 30 minutes
  if (lastNudgeAt) {
    const lastTime = new Date(lastNudgeAt).getTime();
    if (Date.now() - lastTime < THROTTLE_MS) {
      return { shouldNudge: false };
    }
  }

  // Update last_nudge_at
  await supabase
    .from("users")
    .update({ last_nudge_at: new Date().toISOString() })
    .eq("id", userId);

  return { shouldNudge: true, nudgeText: NUDGE_TEXT };
}
