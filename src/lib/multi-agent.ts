// Spec §06 — Multi-Agent System
//
// When complexity >= 7 OR estimated output > 3000 tokens, SEER splits
// the work into a pipeline (research or build). Below that threshold
// the simple single-instruction path is used.
//
// SEER prepares INSTRUCTIONS — it does not execute steps itself.
// Each step is an instruction block that Claude Code executes sequentially
// (research) or with parallel slices (build step 2).

import { STRICT_RULES } from "./strict-rules.js";
import { SECURITY_ANCHOR } from "./security.js";

const API_BASE = process.env["SEER_WEB_URL"] ?? "https://www.seermcp.com";

// --- Routing gate ---

export type PipelineType = "research" | "build";

export interface MultiAgentDecision {
  shouldUse: boolean;
  pipeline: PipelineType | null;
  reason: string;
}

const RESEARCH_KEYWORDS = /\b(how|what|why|should|compare|analy[sz]|evaluat|best.?approach|research|decide|trade.?off|review|audit|explain)\b/i;

/**
 * Decide whether multi-agent should fire and which pipeline to use.
 */
export function shouldUseMultiAgent(
  complexityScore: number,
  input: string
): MultiAgentDecision {
  if (complexityScore < 7) {
    return { shouldUse: false, pipeline: null, reason: `complexity ${complexityScore}/10 < 7 — simple path` };
  }

  // Research pipeline: questions, analysis, decisions
  if (RESEARCH_KEYWORDS.test(input) && !/\b(build|create|implement|write|generate|add|fix)\b/i.test(input)) {
    return { shouldUse: true, pipeline: "research", reason: `complexity ${complexityScore}/10 + research intent → 4-step research pipeline` };
  }

  // Build pipeline: everything else at high complexity
  return { shouldUse: true, pipeline: "build", reason: `complexity ${complexityScore}/10 + build intent → 3-step build pipeline` };
}

// --- Step plan display (shown to user before running) ---

export function buildStepPlan(pipeline: PipelineType, input: string): string {
  if (pipeline === "research") {
    return `[SEER] this task needs 4 steps to do properly.

running all at once reduces quality. here is the plan:

step 1 — scan your project memory
  why: claude needs to know what context and decisions
       already exist before researching
  model: haiku · fast · cheap
  run: seer step 1

step 2 — research and analyze
  why: deep reasoning about your question using
       project context from step 1
  model: sonnet · reasoning quality
  run: seer step 2

step 3 — fact-check against decisions
  why: validates the research against your existing
       architectural decisions to catch conflicts
  model: sonnet · validation
  run: seer step 3

step 4 — produce clean final output
  why: merges research and fact-check into one
       structured, actionable answer
  model: sonnet · coordinator
  run: seer step 4

type \`seer auto\` to run all steps automatically.
each step costs 1 call (4 total).`;
  }

  // Build pipeline
  return `[SEER] this task needs 3 steps to do properly.

running all at once reduces quality. here is the plan:

step 1 — scan project and split into slices
  why: claude needs to map what exists and split
       the build into independent pieces
  model: haiku · fast · cheap
  run: seer step 1

step 2 — build all slices simultaneously
  why: independent pieces build in parallel —
       auth, API, UI all at the same time
  model: your model · full quality
  run: seer step 2

step 3 — merge everything cleanly
  why: connects all slices into one working build
       with correct imports and naming
  model: sonnet · coordinator
  run: seer step 3

type \`seer auto\` to run all steps automatically.
each step costs 1 call (3 total).`;
}

// --- Pipeline state (per API key session) ---

export interface PipelineState {
  pipeline: PipelineType;
  input: string;
  currentStep: number;
  totalSteps: number;
  completedSteps: string[]; // output labels from completed steps
  apiKey: string;
  createdAt: number;
}

const pipelineStates = new Map<string, PipelineState>();
const PIPELINE_TTL = 30 * 60 * 1000; // 30 min

/** Store pipeline state for step-by-step execution. */
export function storePipelineState(apiKey: string, state: PipelineState): void {
  state.createdAt = Date.now();
  pipelineStates.set(apiKey, state);
}

/** Get active pipeline state. Returns null if expired or missing. */
export function getPipelineState(apiKey: string): PipelineState | null {
  const state = pipelineStates.get(apiKey);
  if (!state) return null;
  if (Date.now() - state.createdAt > PIPELINE_TTL) {
    pipelineStates.delete(apiKey);
    return null;
  }
  return state;
}

/** Clear pipeline state (after completion or cancel). */
export function clearPipelineState(apiKey: string): void {
  pipelineStates.delete(apiKey);
}

// Evict expired pipelines every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of pipelineStates) {
    if (now - state.createdAt > PIPELINE_TTL) pipelineStates.delete(key);
  }
}, 10 * 60_000).unref?.();

// --- Instruction builders ---

/**
 * Build the instruction for a specific step of the research pipeline.
 */
function buildResearchStep(step: number, input: string, apiKey: string): string {
  switch (step) {
    case 1:
      return `switch to haiku now. this entire response uses haiku only.

[SEER MULTI-AGENT] Research Pipeline — Step 1 of 4: Memory Scanner

Scan the project's aspect files for context relevant to this query:
"${input}"

1. Derive PROJECT_NAME from package.json "name" or current directory name.
2. Fetch aspect files:
   curl -s "${API_BASE}/api/seer/memory-aspect?project=PROJECT_NAME&aspects=project_overview,architecture,decisions,errors_fixes" \\
     -H "Authorization: Bearer ${apiKey}"
3. From the response, extract ONLY the information relevant to the query above.
4. Output a focused summary — 5 bullets max. Label each bullet with which aspect it came from.
5. End with exactly: [STEP 1 COMPLETE]

Do NOT answer the query. Only gather context.
${STRICT_RULES}
${SECURITY_ANCHOR}`;

    case 2:
      return `switch to sonnet now. this entire response uses sonnet only.

[SEER MULTI-AGENT] Research Pipeline — Step 2 of 4: Research Agent

Using the context from [STEP 1 COMPLETE] above, research and answer this query in depth:
"${input}"

Rules:
- Use the project context from Step 1 to ground your answer.
- Be project-specific — don't give generic advice.
- Provide concrete recommendations with reasoning.
- Reference specific files, patterns, or decisions from the context.
- End with exactly: [STEP 2 COMPLETE]

${STRICT_RULES}`;

    case 3:
      return `switch to sonnet now. this entire response uses sonnet only.

[SEER MULTI-AGENT] Research Pipeline — Step 3 of 4: Fact Checker

Validate the research output from [STEP 2 COMPLETE] against the project's existing decisions.

1. Read the decisions from [STEP 1 COMPLETE] context.
2. Check each recommendation from Step 2 for conflicts with existing decisions.
3. If no conflicts: output "VALIDATED — no conflicts with existing decisions."
4. If conflicts found: list each conflict with the decision it contradicts.
5. End with exactly: [STEP 3 COMPLETE]

Do NOT add new research. Only validate.
${STRICT_RULES}`;

    case 4:
      return `switch to sonnet now. this entire response uses sonnet only.

[SEER MULTI-AGENT] Research Pipeline — Step 4 of 4: Coordinator

Merge the research from [STEP 2 COMPLETE] and the validation from [STEP 3 COMPLETE] into one clean, structured output.

Rules:
- If Step 3 found conflicts, silently correct the research (don't mention the conflicts).
- Produce a clear, actionable answer to: "${input}"
- Structure with headers and bullet points.
- End with exactly: [STEP 4 COMPLETE]

${STRICT_RULES}`;

    default:
      return `Error: Invalid research step ${step}. Valid steps are 1-4.`;
  }
}

/**
 * Build the instruction for a specific step of the build pipeline.
 */
function buildBuildStep(step: number, input: string, apiKey: string): string {
  switch (step) {
    case 1:
      return `switch to haiku now. this entire response uses haiku only.

[SEER MULTI-AGENT] Build Pipeline — Step 1 of 3: Project Scanner

Scan the project to map what exists and plan the build for:
"${input}"

1. Derive PROJECT_NAME from package.json "name" or current directory name.
2. Fetch aspect files:
   curl -s "${API_BASE}/api/seer/memory-aspect?project=PROJECT_NAME&aspects=architecture,features" \\
     -H "Authorization: Bearer ${apiKey}"
3. Read the project structure (ls src/, check key files).
4. Map what already exists vs what needs to be built.
5. Split the task into 2-3 independent slices. Each slice must be buildable in isolation:
   - Slice A: [scope — e.g. backend/API layer]
   - Slice B: [scope — e.g. frontend/UI layer]
   - Slice C: [scope — e.g. tests/integration, if needed]
6. For each slice, list:
   - Files to create or modify
   - Dependencies on existing code
   - Expected output
7. End with exactly: [STEP 1 COMPLETE]

Do NOT write any code. Only plan and split.
${STRICT_RULES}
${SECURITY_ANCHOR}`;

    case 2:
      return `[SEER MULTI-AGENT] Build Pipeline — Step 2 of 3: Parallel Build

Using the slice plan from [STEP 1 COMPLETE], build ALL slices now.

IMPORTANT: Build every slice in this single response. Each slice is independent — do not let one slice's code depend on another's output.

For each slice, follow this format:
---
## [SLICE A] — [scope name]
[build the code for this slice]
[SLICE A COMPLETE]
---
## [SLICE B] — [scope name]
[build the code for this slice]
[SLICE B COMPLETE]
---
## [SLICE C] — [scope name] (if planned in Step 1)
[build the code for this slice]
[SLICE C COMPLETE]
---

Rules:
- Each slice has its own strict scope — auth slice touches no UI, UI touches no backend.
- Complete every function fully — no placeholders, no TODOs.
- Follow the file list from Step 1 exactly.
- End with exactly: [STEP 2 COMPLETE]

${STRICT_RULES}`;

    case 3:
      return `switch to sonnet now. this entire response uses sonnet only.

[SEER MULTI-AGENT] Build Pipeline — Step 3 of 3: Build Coordinator

Merge all slice outputs from [STEP 2 COMPLETE] into a coherent, working build.

1. Review each [SLICE X COMPLETE] output.
2. Resolve any naming conflicts between slices.
3. Ensure imports and exports connect correctly across slices.
4. Add any missing glue code (imports, re-exports, route wiring) that connects the slices.
5. Do NOT add code that wasn't in any slice — only connect what exists.
6. Output the final merged code with clear file paths.
7. End with exactly: [BUILD COMPLETE]

${STRICT_RULES}`;

    default:
      return `Error: Invalid build step ${step}. Valid steps are 1-3.`;
  }
}

/**
 * Build the instruction for a specific step of any pipeline.
 */
export function buildStepInstruction(
  pipeline: PipelineType,
  step: number,
  input: string,
  apiKey: string
): string {
  if (pipeline === "research") {
    return buildResearchStep(step, input, apiKey);
  }
  return buildBuildStep(step, input, apiKey);
}

/**
 * Build all steps as one combined instruction for "seer auto".
 * Each step is separated clearly so Claude executes them sequentially.
 */
export function buildAutoInstruction(
  pipeline: PipelineType,
  input: string,
  apiKey: string
): string {
  const totalSteps = pipeline === "research" ? 4 : 3;
  const steps: string[] = [];

  for (let i = 1; i <= totalSteps; i++) {
    steps.push(buildStepInstruction(pipeline, i, input, apiKey));
  }

  const header = `[SEER MULTI-AGENT] Running ${pipeline} pipeline — ${totalSteps} steps automatically.\n\nExecute each step in order. Wait for each step's completion label before starting the next.\n\n`;

  return header + steps.join("\n\n---\n\n");
}

/** Reset all pipeline states — for testing. */
export function _resetAllPipelines(): void {
  pipelineStates.clear();
}
