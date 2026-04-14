// Mode and Model Switch (Spec §04)
//
// SEER Engine ALWAYS uses Haiku. This module does NOT change the engine model.
//
// Instead, it analyzes the user's intent and complexity, then generates an
// INSTRUCTION that gets prepended to SEER's optimized output. This instruction
// tells Claude Code which model/mode to use for executing the task on the
// user's side.
//
// Rules:
// - Build/create tasks → use the user's preferred model (already set in Claude Code)
// - Plan/analyze tasks → SEER recommends haiku or sonnet based on complexity
// - Quick/compress tasks → no model instruction (use whatever is current)
// - The instruction is a single line prepended to the response, e.g.:
//   "switch to sonnet now. this entire response uses sonnet only."

// --- Modes ---
export type SeerMode = "compress" | "analyze" | "plan" | "quick" | "build";

export interface ModeSwitchResult {
  mode: SeerMode;
  modelInstruction: string;  // instruction prepended to SEER output for Claude Code
  recommendedModel: string;  // short label for footer display: "haiku", "sonnet", "user-preferred"
  reason: string;            // human-readable explanation
}

// --- Intent patterns ---
// Each pattern maps to a mode. First match wins (order = priority).

const MODE_PATTERNS: Array<{ mode: SeerMode; pattern: RegExp }> = [
  // Quick — trivial requests, status checks, lookups, one-word tweaks, git ops
  { mode: "quick",    pattern: /^(status|tools|help|version|ping|show|list|what is|rename\b|move\b)(\s|$)/i },
  { mode: "quick",    pattern: /\b(commit|push|pull|merge|cherry[- ]?pick|rebase|stash|tag)\b/i },
  { mode: "quick",    pattern: /^.{0,20}$/ }, // very short inputs (≤20 chars)

  // Plan — workflow decomposition, multi-step planning
  { mode: "plan",     pattern: /\b(plan|workflow|roadmap|decompose|break down|step[s-]by[- ]step|phases?|stages?)\b/i },

  // Analyze — debugging, investigation, explain, review
  { mode: "analyze",  pattern: /\b(debug|investigate|explain|analyze|review|audit|diagnose|why does|how does|trace|inspect)\b/i },

  // Build — feature creation, implementation, code generation
  { mode: "build",    pattern: /\b(build|create|implement|develop|add feature|new feature|generate|scaffold|setup|wire up|integrate)\b/i },

  // Compress — default for prompt optimization (explicit or fallback)
  { mode: "compress", pattern: /\b(compress|optimize|shorten|rewrite|improve|refine|simplify|reduce)\b/i },
];

function detectMode(input: string): SeerMode {
  for (const { mode, pattern } of MODE_PATTERNS) {
    if (pattern.test(input)) return mode;
  }
  return "compress";
}

// --- Model instruction generation ---
//
// Based on mode + complexity, generate the instruction line that tells Claude
// Code which model to use. SEER itself stays on Haiku always.

function generateInstruction(mode: SeerMode, complexityScore: number): { instruction: string; recommendedModel: string; reason: string } {
  switch (mode) {
    case "quick":
      return {
        instruction: "switch to haiku now. this entire response uses haiku only.",
        recommendedModel: "haiku",
        reason: "quick task → haiku (fast, cheap)",
      };

    case "compress":
      return {
        instruction: "switch to haiku now. this entire response uses haiku only.",
        recommendedModel: "haiku",
        reason: "compress task → haiku (sufficient for optimization)",
      };

    case "build":
      return {
        instruction: "",
        recommendedModel: "user-preferred",
        reason: "build task → user's preferred model (no override)",
      };

    case "analyze":
      if (complexityScore >= 6) {
        return {
          instruction: "switch to sonnet now. this entire response uses sonnet only.",
          recommendedModel: "sonnet",
          reason: `analyze task + complexity ${complexityScore}/10 → sonnet (deeper reasoning needed)`,
        };
      }
      return {
        instruction: "switch to haiku now. this entire response uses haiku only.",
        recommendedModel: "haiku",
        reason: `analyze task + complexity ${complexityScore}/10 → haiku (sufficient)`,
      };

    case "plan":
      if (complexityScore >= 6) {
        return {
          instruction: "switch to sonnet now. this entire response uses sonnet only.",
          recommendedModel: "sonnet",
          reason: `plan task + complexity ${complexityScore}/10 → sonnet (better multi-step reasoning)`,
        };
      }
      return {
        instruction: "switch to haiku now. this entire response uses haiku only.",
        recommendedModel: "haiku",
        reason: `plan task + complexity ${complexityScore}/10 → haiku (sufficient)`,
      };

    default:
      return {
        instruction: "",
        recommendedModel: "haiku",
        reason: "unknown mode → no model instruction",
      };
  }
}

// --- Main entry ---

export function detectModeAndModel(input: string, complexityScore: number): ModeSwitchResult {
  const mode = detectMode(input);
  const { instruction, recommendedModel, reason } = generateInstruction(mode, complexityScore);
  return { mode, modelInstruction: instruction, recommendedModel, reason };
}
