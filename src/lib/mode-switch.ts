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
  modelInstruction: string; // instruction prepended to SEER output for Claude Code
  reason: string;           // human-readable explanation
}

// --- Intent patterns ---
// Each pattern maps to a mode. First match wins (order = priority).

const MODE_PATTERNS: Array<{ mode: SeerMode; pattern: RegExp }> = [
  // Quick — trivial requests, status checks, lookups, one-word tweaks
  { mode: "quick",    pattern: /^(status|tools|help|version|ping|show|list|what is|rename\b|move\b)(\s|$)/i },
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

function generateInstruction(mode: SeerMode, complexityScore: number): { instruction: string; reason: string } {
  switch (mode) {
    case "quick":
      // No model switch needed — quick tasks run fine on whatever model is active
      return {
        instruction: "switch to haiku now. this entire response uses haiku only.",
        reason: "quick task → haiku (fast, cheap)",
      };

    case "compress":
      // Compression is lightweight — haiku is fine
      return {
        instruction: "switch to haiku now. this entire response uses haiku only.",
        reason: "compress task → haiku (sufficient for optimization)",
      };

    case "build":
      // Build tasks should use the user's preferred model — don't override
      return {
        instruction: "",
        reason: "build task → user's preferred model (no override)",
      };

    case "analyze":
      // Low complexity analysis → haiku, high complexity → sonnet
      if (complexityScore >= 6) {
        return {
          instruction: "switch to sonnet now. this entire response uses sonnet only.",
          reason: `analyze task + complexity ${complexityScore}/10 → sonnet (deeper reasoning needed)`,
        };
      }
      return {
        instruction: "switch to haiku now. this entire response uses haiku only.",
        reason: `analyze task + complexity ${complexityScore}/10 → haiku (sufficient)`,
      };

    case "plan":
      // Low complexity planning → haiku, high complexity → sonnet
      if (complexityScore >= 6) {
        return {
          instruction: "switch to sonnet now. this entire response uses sonnet only.",
          reason: `plan task + complexity ${complexityScore}/10 → sonnet (better multi-step reasoning)`,
        };
      }
      return {
        instruction: "switch to haiku now. this entire response uses haiku only.",
        reason: `plan task + complexity ${complexityScore}/10 → haiku (sufficient)`,
      };

    default:
      return {
        instruction: "",
        reason: "unknown mode → no model instruction",
      };
  }
}

// --- Main entry ---

export function detectModeAndModel(input: string, complexityScore: number): ModeSwitchResult {
  const mode = detectMode(input);
  const { instruction, reason } = generateInstruction(mode, complexityScore);
  return { mode, modelInstruction: instruction, reason };
}
