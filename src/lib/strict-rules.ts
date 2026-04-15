// Spec §05 — Strict Execution Instruction
//
// 10 non-negotiable rules appended to every SEER-optimized prompt.
// Aspect file targeting lives in aspect-memory.ts (getAspectsForTask).

/** The 10 strict execution rules appended to every instruction. */
export const STRICT_RULES = `STRICT RULES — FOLLOW EXACTLY:
1.  Build ONLY what the user asked for. Nothing outside it.
2.  Do NOT add features, improvements, or suggestions.
3.  Do NOT rewrite or refactor existing working code.
4.  Do NOT add explanatory comments to the code.
5.  Do NOT ask clarifying questions — execute now.
6.  Do NOT repeat code that already exists in the codebase.
7.  Every line must directly serve the user's request.
8.  Complete every function fully — no placeholders, no TODOs.
9.  No 'you might also want to...' suggestions.
10. If token limit approached — finish current unit cleanly,
    output: [SEER: chunk complete. Run seer continue.]
    then stop. Never stop mid-function.`;

import type { TaskType } from "./aspect-memory.js";

// Pattern groups for task classification
const SECURITY_KEYWORDS = /\b(secur\w*|auth|csrf|xss|injection|cors|rls|mfa|totp|encrypt\w*|token|jwt|permission|rbac|guard|sanitiz\w*|vulnerab\w*)\b/i;
const BUG_FIX_KEYWORDS = /\b(fix|bug|broken|crash|error|fail|issue|wrong|regress|patch|hotfix|debug)\b/i;
const PAYMENT_AUTH_KEYWORDS = /\b(payment|billing|subscript|checkout|stripe|razorpay|dodo|invoice|auth(?:enticat|oriz)|login|signup|sign.?up|session|oauth)\b/i;
const RESEARCH_PLAN_KEYWORDS = /\b(how|what|why|should|compare|analy[sz]|evaluat|best.?approach|research|plan|strateg|structure|decide|architect|design|review)\b/i;
const FEATURE_KEYWORDS = /\b(build|create|add|implement|write|generate|develop|make|new feature|endpoint|component|page|route|module|integrat)\b/i;

/**
 * Classify user input into a task type for aspect file targeting.
 * Used by seer_run to determine which aspect files to load for Pro+ users.
 *
 * @param input      - User's raw prompt text
 * @param complexity - Complexity score (1-10) from scoreComplexity()
 * @returns TaskType determining which aspect files to load
 */
export function classifyTaskType(input: string, complexity: number): TaskType {
  // Full feature: complexity 8+ always loads everything
  if (complexity >= 8) return "full_feature";

  // Security tasks take priority (high-risk)
  if (SECURITY_KEYWORDS.test(input)) return "security";

  // Payment/auth builds (also high-risk)
  if (PAYMENT_AUTH_KEYWORDS.test(input)) return "payment_auth";

  // Bug fixes
  if (BUG_FIX_KEYWORDS.test(input) && !FEATURE_KEYWORDS.test(input)) return "bug_fix";

  // Research / planning (questions, analysis, decisions)
  if (RESEARCH_PLAN_KEYWORDS.test(input) && !FEATURE_KEYWORDS.test(input)) return "research";

  // Feature build (has build verbs + moderate complexity)
  if (FEATURE_KEYWORDS.test(input) && complexity >= 4) return "feature_build";

  // Default: simple build
  return "simple_build";
}
